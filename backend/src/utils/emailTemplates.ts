export const buildEmailTemplate = (title: string, message: string, details?: Record<string, string>) => {
  const detailsHtml = details
    ? `<div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0;">
         <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">Details</h3>
         <table style="width: 100%; border-collapse: collapse;">
           ${Object.entries(details)
             .map(
               ([key, value]) => `
             <tr>
               <td style="padding: 8px 0; color: #64748b; font-weight: 500; width: 120px;">${key}</td>
               <td style="padding: 8px 0; color: #0f172a;">${value}</td>
             </tr>
           `
             )
             .join('')}
         </table>
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <!-- Header -->
    <tr>
      <td style="background-color: #2563eb; padding: 32px 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Unthink Clinic</h1>
      </td>
    </tr>
    
    <!-- Body -->
    <tr>
      <td style="padding: 40px;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">${title}</h2>
        
        <p style="font-size: 16px; margin-bottom: 24px;">
          ${message}
        </p>
        
        ${detailsHtml}
        
        <p style="font-size: 15px; color: #64748b; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
          If you have any questions, please reply to this email or contact our support team.
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #94a3b8; font-size: 14px;">
          &copy; ${new Date().getFullYear()} Unthink Clinic. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
  
</body>
</html>
  `;
};
