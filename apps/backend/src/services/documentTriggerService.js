const { query } = require('../config/db');

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'http://127.0.0.1:5000';

/**
 * Trigger document generation via Python PDF Automation Service (E:\code_plus_academy\TEMP\pdf_automation).
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

    const payload = {
      template: docDetails.template_name || 'offer_letter.html',
      data: {
        name: app.candidate_name,
        role: docDetails.offer_title || app.position_title,
        company_name: 'Code+ Academy',
        holding_company: 'Code Plus Education',
        serial_no: docDetails.serial_number || `OFFER-${new Date().getFullYear()}-000001`,
        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        duration: docDetails.duration || '6 Months',
        compensation: docDetails.compensation || 'Standard Rate'
      }
    };

    console.log(`[DocumentTrigger] Calling PDF Service at ${PDF_SERVICE_URL}/api/generate-certificate-info for application ${applicationId}...`);

    const response = await fetch(`${PDF_SERVICE_URL}/api/generate-certificate-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[DocumentTrigger] PDF Service returned status ${response.status}: ${errText}`);
      return 'pdf_service_error';
    }

    const resData = await response.json();
    const generatedPdfUrl = resData.cloud_storage_urls?.supabase || resData.cloud_storage_urls?.s3 || resData.file_info?.local_download_url;

    if (generatedPdfUrl) {
      await query(
        `UPDATE hiring_generated_documents
         SET pdf_url = $1
         WHERE application_id = $2 AND document_type = 'offer_letter' AND pdf_url IS NULL`,
        [generatedPdfUrl, applicationId]
      );
      console.log(`[DocumentTrigger] Successfully generated PDF for app ${applicationId}: ${generatedPdfUrl}`);
    }

    return 'generated';
  } catch (err) {
    console.warn(`[DocumentTrigger] Could not connect to PDF Automation Service at ${PDF_SERVICE_URL}: ${err.message}. (PDF generation logged as pending).`);
    return 'fallback_stubbed';
  }
}

module.exports = { triggerDocumentGeneration };
