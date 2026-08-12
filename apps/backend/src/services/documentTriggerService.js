const { query } = require('../config/db');
const { sendTemplatedEmail } = require('./emailTemplateCompiler');

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'https://certification-bacnkend.onrender.com';
const PDF_SERVICE_API_KEY = process.env.PDF_SERVICE_API_KEY || 'cpa_sk_89f2a71e4b9d0831';

/**
 * Direct fetch wrapper for PolyCert Studio API using X-API-Key & Bearer header.
 */
async function polyCertFetch(urlPath, options = {}) {
  const fullUrl = urlPath.startsWith('http') ? urlPath : `${PDF_SERVICE_URL}${urlPath}`;
  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': PDF_SERVICE_API_KEY,
    'Authorization': `Bearer ${PDF_SERVICE_API_KEY}`,
    ...(options.headers || {})
  };

  return await fetch(fullUrl, {
    ...options,
    method,
    headers
  });
}

/**
 * Fetch all installed Jinja2 templates and variable definitions from PolyCert Studio.
 */
async function fetchPolyCertTemplates() {
  try {
    const response = await polyCertFetch('/api/templates', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PolyCert API returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.templates || [];
  } catch (err) {
    console.error(`[DocumentTrigger] Failed to fetch PolyCert templates: ${err.message}`);
    throw err;
  }
}

/**
 * Fetch raw template HTML and Jinja2 variables for a specific template file from PolyCert Studio.
 */
async function getPolyCertTemplateHtml(filename) {
  try {
    const response = await polyCertFetch(`/api/templates/${encodeURIComponent(filename)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PolyCert API returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error(`[DocumentTrigger] Failed to fetch HTML for PolyCert template '${filename}': ${err.message}`);
    throw err;
  }
}

/**
 * Render a live Jinja2 HTML preview by fetching the template from PolyCert Studio and substituting variables.
 */
async function renderPolyCertTemplatePreview(templateName, templateData = {}) {
  const tplInfo = await getPolyCertTemplateHtml(templateName);
  let html = tplInfo.html_content || '';

  // Default cursive SVG signature data URI for signature_image placeholder
  const defaultSigSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='60'><text x='10' y='40' font-family='cursive' font-size='24' fill='%231e3a8a'>Dr. Alex Vance</text></svg>";
  if (!templateData.signature_image) {
    templateData.signature_image = defaultSigSvg;
  }

  // Substitute Jinja2 {{ variable }} placeholders with values
  Object.entries(templateData).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(pattern, String(value));
    }
  });

  // Replace any remaining unreplaced {{ signature_image }} or {{ variable }} placeholders to prevent 404s
  html = html.replace(/\{\{\s*signature_image\s*\}\}/g, defaultSigSvg);
  html = html.replace(/\{\{\s*[\w_]+\s*\}\}/g, '');

  return {
    filename: tplInfo.filename,
    variables: tplInfo.variables || [],
    rendered_html: html
  };
}

/**
 * Trigger document generation via Python PDF Automation Service (Certification Backend).
 * Generates offer letter / certificate PDF and updates pdf_url in hiring_generated_documents.
 */
async function triggerDocumentGeneration(applicationId, docDetails = {}) {
  try {
    const appRes = await query(
      `SELECT a.*, c.name AS candidate_name, c.email AS candidate_email, p.title AS position_title
       FROM hiring_applications a
       JOIN hiring_candidates c ON a.candidate_id = c.id
       JOIN hiring_positions p ON a.position_id = p.id
       WHERE a.id = $1`,
      [applicationId]
    );

    if (appRes.rows.length === 0) {
      console.log(`[DocumentTrigger] Application ${applicationId} not found`);
      throw new Error(`Application ${applicationId} not found`);
    }

    const app = appRes.rows[0];
    const docType = docDetails.document_type || 'offer_letter';
    const isCertificate = docType === 'certificate' || docDetails.template_name?.includes('certificate');

    const isoToReadable = (d) => new Date(d || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const sixMonthsLater = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const payload = {
      template: docDetails.template_name || (isCertificate ? 'certificate.html' : 'offer_letter.html'),
      data: {
        // ── All user-provided overrides first (lowest priority) ──
        ...docDetails,

        // ── DB-verified fields always win ─────────────────────────
        name: app.candidate_name,
        role: docDetails.offer_title || docDetails.role || app.position_title,

        // ── certificate.html ─────────────────────────────────────
        // date, doc_tag, duration, eyebrow, holding_company,
        // name, organization_name, role, serial_no, signatory,
        // signatory_role, signature_image, signature_text
        organization_name: docDetails.organization_name || 'Code Plus Academy',
        company_name: docDetails.company_name || docDetails.organization_name || 'Code+ Academy',
        holding_company: docDetails.holding_company || 'Code Plus Education',
        serial_no: docDetails.serial_number || `${(isCertificate ? 'CERT' : 'OFFER')}-${new Date().getFullYear()}-000001`,
        date: docDetails.date || isoToReadable(),
        duration: docDetails.duration || '6 Months',
        doc_tag: docDetails.doc_tag || (isCertificate ? 'OFFICIAL CERTIFICATE' : 'OFFICIAL OFFER LETTER'),
        eyebrow: docDetails.eyebrow || 'CODE PLUS ACADEMY CREDENTIAL',
        signatory: docDetails.signatory || 'Dr. Alex Vance',
        signatory_role: docDetails.signatory_role || 'Director of Engineering',
        signature_text: docDetails.signature_text || docDetails.signatory || 'Dr. Alex Vance',

        // ── certificate_of_compleation.html ──────────────────────
        // date, end_date, name, organization_name, program_lead,
        // program_lead_org, program_lead_title, role, serial_no,
        // signatory, signatory_title, start_date, status
        start_date: docDetails.start_date || docDetails.date || isoToReadable(),
        end_date: docDetails.end_date || sixMonthsLater,
        status: docDetails.status || 'SUCCESSFULLY COMPLETED',
        program_lead: docDetails.program_lead || docDetails.signatory || 'Dr. Alex Vance',
        program_lead_org: docDetails.program_lead_org || docDetails.organization_name || 'Code Plus Academy',
        program_lead_title: docDetails.program_lead_title || docDetails.signatory_role || 'Director of Engineering',
        signatory_title: docDetails.signatory_title || docDetails.signatory_role || 'Director of Engineering',

        // ── offer_letter.html ─────────────────────────────────────
        // company_name, date, duration, holding_company, name,
        // role, serial_no, signatory, signatory_role,
        // signature_image, signature_text
        compensation: docDetails.compensation || 'Standard Rate',

        // ── offer_letter_v2.html ──────────────────────────────────
        // address, date, end_date, engagement, name,
        // organization_name, reporting_to, role, serial_no,
        // signatory, signatory_title, start_date, work_mode
        address: docDetails.address || 'Remote / India',
        engagement: docDetails.engagement || 'Internship',
        reporting_to: docDetails.reporting_to || docDetails.signatory || 'Dr. Alex Vance',
        work_mode: docDetails.work_mode || 'Remote',
      }
    };

    console.log(`[DocumentTrigger] Calling PolyCert Studio API at ${PDF_SERVICE_URL}/api/generate-certificate-info for application ${applicationId}...`);

    const response = await polyCertFetch('/api/generate-certificate-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[DocumentTrigger] PolyCert API error status ${response.status}: ${errText}`);
      throw new Error(`PolyCert PDF Generation failed (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    const generatedPdfUrl =
      resData.cloud_storage_urls?.supabase_url ||
      resData.cloud_storage_urls?.supabase ||
      resData.cloud_storage_urls?.s3 ||
      resData.cloud_storage_urls?.local_download_url ||
      resData.file_info?.local_download_url;

    if (generatedPdfUrl) {
      await query(
        `UPDATE hiring_generated_documents
         SET pdf_url = $1
         WHERE application_id = $2 AND document_type = $3 AND pdf_url IS NULL`,
        [generatedPdfUrl, applicationId, docType]
      );
      console.log(`[DocumentTrigger] Successfully generated PDF for app ${applicationId} (${docType}): ${generatedPdfUrl}`);

      // Dispatch dynamic email using configured templates to candidate & admin
      try {
        const templateKey = isCertificate ? 'hiring_certificate' : 'hiring_offer_letter';
        const candidateEmail = app.candidate_email;
        const adminEmail = docDetails.admin_email || process.env.ADMIN_NOTIFY_EMAIL || 'admin@codeplusacademy.in';
        const serialNo = docDetails.serial_number || `${(isCertificate ? 'CERT' : 'OFFER')}-${new Date().getFullYear()}-000001`;

        const candName = app.candidate_name || docDetails.name || docDetails.candidate_name || 'Candidate';
        const candEmail = app.candidate_email || docDetails.email || docDetails.candidate_email || '';
        const posTitle = docDetails.offer_title || docDetails.role || docDetails.role_title || docDetails.position || app.position_title || 'Software Developer';
        const comp = docDetails.compensation || docDetails.salary || 'Standard Rate';
        const dept = docDetails.organization_name || docDetails.company_name || docDetails.department || 'Code Plus Academy';
        const startDate = docDetails.start_date || docDetails.date || docDetails.startdate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const expiryDate = docDetails.deadline || docDetails.offer_deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const signatoryName = docDetails.signatory || docDetails.manager_name || docDetails.signature_text || 'Dr. Alex Vance';
        const signatoryTitle = docDetails.signatory_role || docDetails.signatory_title || 'Director of Engineering';

        const emailPayload = {
          // Candidate & Personal Details
          name: candName,
          display_name: candName,
          candidate_name: candName,
          email: candEmail,
          candidate_email: candEmail,

          // Position & Role Details
          position: posTitle,
          role: posTitle,
          role_title: posTitle,
          offer_title: posTitle,
          position_title: posTitle,

          // Department & Company Details
          department: dept,
          company_name: dept,
          organization_name: dept,
          holding_company: docDetails.holding_company || 'Code Plus Education',

          // Compensation & Expiration Dates
          salary: comp,
          compensation: comp,
          startdate: startDate,
          start_date: startDate,
          date: startDate,
          offer_deadline: expiryDate,
          deadline: expiryDate,
          duration: docDetails.duration || '6 Months',

          // Generated PDF Links & Tracking Serials
          offer_pdf_link: generatedPdfUrl,
          certificate_pdf_link: generatedPdfUrl,
          pdf_url: generatedPdfUrl,
          serial_no: serialNo,
          serial_number: serialNo,

          // Signatory & Approval Details
          signatory: signatoryName,
          signatory_role: signatoryTitle,
          signatory_title: signatoryTitle,
          signature_text: signatoryName,

          ...docDetails
        };

        // 1. Dispatch email to Candidate
        if (candidateEmail) {
          console.log(`[DocumentTrigger] Dispatching '${templateKey}' email to candidate (${candidateEmail}) with document URL...`);
          await sendTemplatedEmail({
            templateKey,
            recipientEmail: candidateEmail,
            payload: emailPayload
          }).catch(err => console.error(`[DocumentTrigger] Failed sending candidate email: ${err.message}`));
        }

        // 2. Dispatch notification email to Admin (approver)
        if (adminEmail && adminEmail !== candidateEmail) {
          console.log(`[DocumentTrigger] Dispatching '${templateKey}' copy notification to admin (${adminEmail})...`);
          await sendTemplatedEmail({
            templateKey,
            recipientEmail: adminEmail,
            payload: {
              ...emailPayload,
              name: `Admin (${docDetails.admin_name || 'Approver'}) — Issued for ${app.candidate_name}`
            }
          }).catch(err => console.error(`[DocumentTrigger] Failed sending admin notification email: ${err.message}`));
        }
      } catch (emailErr) {
        console.error(`[DocumentTrigger] Error preparing document email dispatch: ${emailErr.message}`);
      }
    }

    return {
      status: 'generated',
      pdf_url: generatedPdfUrl,
      request_id: resData.request_id,
      certificate_serial: resData.certificate_serial
    };
  } catch (err) {
    console.error(`[DocumentTrigger] Error in PolyCert PDF Generation: ${err.message}`);
    throw err;
  }
}

/**
 * Create or update a custom Jinja2 HTML template on PolyCert Studio.
 */
async function savePolyCertTemplate(name, html) {
  try {
    const response = await polyCertFetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, html })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PolyCert API returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error(`[DocumentTrigger] Failed to save PolyCert template '${name}': ${err.message}`);
    throw err;
  }
}

/**
 * Delete a custom template from PolyCert Studio.
 */
async function deletePolyCertTemplate(filename) {
  try {
    const response = await polyCertFetch(`/api/templates/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PolyCert API returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error(`[DocumentTrigger] Failed to delete PolyCert template '${filename}': ${err.message}`);
    throw err;
  }
}

module.exports = {
  fetchPolyCertTemplates,
  getPolyCertTemplateHtml,
  renderPolyCertTemplatePreview,
  triggerDocumentGeneration,
  savePolyCertTemplate,
  deletePolyCertTemplate
};
