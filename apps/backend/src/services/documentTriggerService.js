const { query } = require('../config/db');

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'https://certification-bacnkend.onrender.com';
const PDF_SERVICE_API_KEY = process.env.PDF_SERVICE_API_KEY || 'cpa_sk_89f2a71e4b9d0831';

let storedSessionCookie = '';

/**
 * Authenticate session against PolyCert Studio (/login) to obtain Flask session cookie.
 */
async function polyCertLogin() {
  try {
    const params = new URLSearchParams();
    params.append('api_key', PDF_SERVICE_API_KEY);

    const res = await fetch(`${PDF_SERVICE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString(),
      redirect: 'manual'
    });

    const cookieHeader = res.headers.get('set-cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/session=[^;]+/);
      if (match) {
        storedSessionCookie = match[0];
        console.log('[DocumentTrigger] Successfully authenticated PolyCert session cookie');
        return storedSessionCookie;
      }
    }
    return '';
  } catch (err) {
    console.error(`[DocumentTrigger] PolyCert login failed: ${err.message}`);
    return '';
  }
}

/**
 * Robust fetch wrapper for PolyCert Studio API that handles automatic session authentication.
 */
async function polyCertFetch(urlPath, options = {}) {
  const fullUrl = urlPath.startsWith('http') ? urlPath : `${PDF_SERVICE_URL}${urlPath}`;
  const method = options.method || 'GET';
  const headers = {
    'X-API-Key': PDF_SERVICE_API_KEY,
    ...(options.headers || {})
  };

  if (storedSessionCookie) {
    headers['Cookie'] = storedSessionCookie;
  }

  let response = await fetch(fullUrl, {
    ...options,
    method,
    headers,
    redirect: 'manual'
  });

  // If redirected to /login (302) or unauthorized (401), authenticate and retry
  if (response.status === 302 || response.status === 401 || response.headers.get('location')?.includes('/login')) {
    console.log('[DocumentTrigger] PolyCert session unauthenticated. Authenticating via POST /login...');
    const cookie = await polyCertLogin();
    if (cookie) {
      headers['Cookie'] = cookie;
    }
    response = await fetch(fullUrl, {
      ...options,
      method,
      headers,
      redirect: 'follow'
    });
  }

  return response;
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

  // Substitute Jinja2 {{ variable }} placeholders with values
  Object.entries(templateData).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(pattern, String(value));
    }
  });

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

    const payload = {
      template: docDetails.template_name || (isCertificate ? 'certificate.html' : 'offer_letter.html'),
      data: {
        name: app.candidate_name,
        role: docDetails.offer_title || docDetails.role || app.position_title,
        company_name: docDetails.organization_name || 'Code+ Academy',
        organization_name: docDetails.organization_name || 'Code Plus Academy',
        holding_company: 'Code Plus Education',
        serial_no: docDetails.serial_number || `${(isCertificate ? 'CERT' : 'OFFER')}-${new Date().getFullYear()}-000001`,
        date: docDetails.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        duration: docDetails.duration || '6 Months',
        compensation: docDetails.compensation || 'Standard Rate',
        signatory: docDetails.signatory || 'Dr. Alex Vance',
        signatory_role: docDetails.signatory_role || 'Director of Engineering',
        signature_text: docDetails.signature_text || docDetails.signatory || 'Dr. Alex Vance'
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

module.exports = {
  fetchPolyCertTemplates,
  getPolyCertTemplateHtml,
  renderPolyCertTemplatePreview,
  triggerDocumentGeneration
};
