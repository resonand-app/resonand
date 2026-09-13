/**
 * The mark on one file's row in the upload tray.
 *
 * Its own module because the tray both writes the rows' cap and does not draw them: `Uploads`
 * spreads this onto each row and `UploadTray` counts them to find the height of five.
 */

export const UPLOAD_ROW = { 'data-upload-row': '' } as const;

export const UPLOAD_ROW_SELECTOR = '[data-upload-row]';
