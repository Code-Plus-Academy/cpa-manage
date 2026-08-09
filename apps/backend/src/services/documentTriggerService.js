const { query } = require('../config/db');

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'https://certification-bacnkend.onrender.com';
const PDF_SERVICE_API_KEY = process.env.PDF_SERVICE_API_KEY || 'cpa_sk_89f2a71e4b9d0831';

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
      return 'application_not_found';
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

    console.log(`[DocumentTrigger] Calling PDF Service at ${PDF_SERVICE_URL}/api/generate-certificate-info for application ${applicationId}...`);

    const response = await fetch(`${PDF_SERVICE_URL}/api/generate-certificate-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PDF_SERVICE_API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[DocumentTrigger] PDF Service returned status ${response.status}: ${errText}`);
      return 'pdf_service_error';
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

    return 'generated';
  } catch (err) {
    console.warn(`[DocumentTrigger] Could not connect to PDF Automation Service at ${PDF_SERVICE_URL}: ${err.message}. (PDF generation logged as pending).`);
    return 'fallback_stubbed';
  }
}

module.exports = { triggerDocumentGeneration };
