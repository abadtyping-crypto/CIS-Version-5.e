# Pending Tasks

This file tracks issues intentionally left for later so the project can move forward without repeatedly staying on the same PDF/customization topic.

## PDF Generation

- Logos and essential image attachments are still not reliably appearing in generated PDFs.
- Verify whether missing images are caused by saved branding data, Firebase/storage URL access, WEBP conversion, PDF renderer image support, or template mapping.
- Remove the unwanted single-instance header currently appearing in generated PDFs.
- Re-check final quotation PDF layout after logo/header corrections.
- Re-check bank details rendering in quotation PDFs after the final PDF layout is stabilized.

## PDF Customization Library

- Create a shared content/template library to replace the unwanted hardcoded PDF header behavior.
- Developer side must support uploading/managing reusable PDF header/footer/content assets.
- Tenant side must consume the uploaded developer library assets inside PDF customization.
- Confirm final library data shape before connecting tenant and developer pages.

## PDF Customization Preview

- Add an A4 live visual preview only inside the PDF Customization page.
- Preview should reflect font, logo position, colors, table styling, watermark, terms, footer, and bank detail visibility.
- Avoid regenerating the actual PDF on every option change; use lightweight React/HTML preview.

## Attachment Handling

- Continue local attachment repository work later.
- Confirm final folder structure under `C:\ACIS Attachments`.
- Extend local attachment save/copy/view behavior beyond quotations to proformas, invoices, portal statements, and payments.
- Ensure all attachment actions stay inside the application unless the user explicitly copies to Downloads.

## Video Customization

- Update the enabled option inside video customization.
- Display the `created by` person's name in the video customization area.
- Confirm the source of the creator identity before saving or displaying it.

## Logo Visibility

- Application logo visibility still needs a final project-wide verification.
- Confirm header/login/PDF/customization pages all resolve the same selected logo source correctly.

