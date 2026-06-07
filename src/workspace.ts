// Web integration client-side helpers for Google Drive and Gmail API

export interface GmailMessage {
  id: string;
  snippet: string;
  subject?: string;
  body?: string;
  parsedCard?: {
    topic: string;
    question: string;
    expectedAnswerSummary: string;
    formulaReference: string;
  };
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime?: string;
}

/**
 * Encodes string to base64url (Gmail API format)
 */
function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * 1. Sends a beautifully formatted HTML study report via Gmail
 */
export async function sendStudyDigestEmail(
  token: string,
  recipient: string,
  subjectName: string,
  stats: { masteredCount: number; reviewCount: number; totalAttempted: number; masteryPercentage: number; elapsedSeconds: number },
  masteredList: Array<{ topic: string; question: string; expectedAnswerSummary: string }>,
  reviewList: Array<{ topic: string; question: string; expectedAnswerSummary: string }>
): Promise<boolean> {
  const timeFormatted = `${Math.floor(stats.elapsedSeconds / 60)}m ${stats.elapsedSeconds % 60}s`;
  
  const masteredRows = masteredList.length > 0 
    ? masteredList.map(card => `
        <tr style="border-top: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: bold; color: #0f172a; font-family: monospace;">${card.topic}</td>
          <td style="padding: 10px; color: #475569;">${card.question}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="2" style="padding: 10px; text-align: center; color: #94a3b8;">No concept cards mastered this turn yet. Keep pushing!</td></tr>';

  const reviewRows = reviewList.length > 0
    ? reviewList.map(card => `
        <tr style="border-top: 1px solid #e2e8f0; background-color: #fffafb;">
          <td style="padding: 10px; font-weight: bold; color: #b91c1c; font-family: monospace;">${card.topic}</td>
          <td style="padding: 10px; color: #475569;">${card.question}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="2" style="padding: 10px; text-align: center; color: #94a3b8;">Perfect score! All conceptual blocks cleared.</td></tr>';

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);">
        
        <!-- Header -->
        <div style="background-color: #0f172a; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: -0.025em; font-family: monospace;">PRO-ENG EXAM PREPARATION REPORT</h1>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8; font-family: monospace; text-transform: uppercase;">Intense Technical Core Learning Digest</p>
        </div>

        <!-- Body -->
        <div style="padding: 24px;">
          <h2 style="font-size: 16px; font-weight: bold; color: #1e293b; margin-top: 0;">Session Subject: <span style="color: #4f46e5;">${subjectName}</span></h2>
          
          <!-- Score Widget -->
          <div style="display: flex; gap: 12px; margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background-color: #f1f5f9; text-align: center;">
            <div style="flex: 1;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Mastered</div>
              <div style="font-size: 18px; font-weight: bold; color: #059669;">${stats.masteredCount}</div>
            </div>
            <div style="flex: 1; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">To Review</div>
              <div style="font-size: 18px; font-weight: bold; color: #dc2626;">${stats.reviewCount}</div>
            </div>
            <div style="flex: 1;">
              <div style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Duration</div>
              <div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 2px;">${timeFormatted}</div>
            </div>
          </div>

          <h3 style="font-size: 13px; font-weight: bold; color: #1e293b; border-bottom: 2px solid #059669; padding-bottom: 4px; margin-top: 24px;">🔥 MASTERED CONCEPTS & EQUATIONS</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
            <thead>
              <tr style="color: #64748b; font-size: 11px;">
                <th style="padding: 8px 10px;">Topic</th>
                <th style="padding: 8px 10px;">Question Abstract</th>
              </tr>
            </thead>
            <tbody>
              ${masteredRows}
            </tbody>
          </table>

          <h3 style="font-size: 13px; font-weight: bold; color: #1e293b; border-bottom: 2px solid #dc2626; padding-bottom: 4px; margin-top: 24px;">🏗️ TOPICS REQUIRING REVISION</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
            <thead>
              <tr style="color: #64748b; font-size: 11px;">
                <th style="padding: 8px 10px;">Topic</th>
                <th style="padding: 8px 10px;">Question Abstract</th>
              </tr>
            </thead>
            <tbody>
              ${reviewRows}
            </tbody>
          </table>

          <p style="font-size: 11px; color: #64748b; margin-top: 30px; text-align: center; border-top: 1px dashed #cbd5e1; pt: 16px;">
            Sent with pride from PRO-ENG study engine. Access your dashboards anytime to generate new custom technical question packs.
          </p>
        </div>
      </div>
    </div>
  `;

  const rawMessage = [
    `To: ${recipient}`,
    `Subject: PRO-ENG Preparedness: ${subjectName} session summary`,
    `Content-Type: text/html; charset=utf-8`,
    `MIME-Version: 1.0`,
    ``,
    htmlBody
  ].join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: base64UrlEncode(rawMessage)
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Failed to dispatch Workspace email:', errText);
    throw new Error('Gmail api dispatch rejected: ' + errText);
  }
  return true;
}

/**
 * 2. Fetches incoming messages from study groups containing study alerts
 * Checks for messages matching subject queries e.g. "PRO-ENG"
 */
export async function fetchInboxFlashcardEmails(token: string): Promise<GmailMessage[]> {
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=subject:(PRO-ENG OR flashcard OR quiz)`;
  const listRes = await fetch(listUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!listRes.ok) {
    throw new Error('Could not pull mail data: ' + await listRes.text());
  }

  const listData = await listRes.json();
  if (!listData.messages || listData.messages.length === 0) {
    return [];
  }

  const results: GmailMessage[] = [];
  // fetch maximum 5 messages to avoid extreme overhead
  const targetMessages = listData.messages.slice(0, 5);

  for (const item of targetMessages) {
    const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (detailRes.ok) {
      const detail = await detailRes.json();
      const headers = detail.payload.headers;
      const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
      const bodySnippet = detail.snippet || '';

      // Try searching for JSON card models directly in email body text
      let bodyText = '';
      if (detail.payload.parts) {
        const textPart = detail.payload.parts.find((p: any) => p.mimeType === 'text/plain');
        if (textPart && textPart.body && textPart.body.data) {
          try {
            bodyText = decodeURIComponent(escape(atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'))));
          } catch (e) {
            bodyText = bodySnippet;
          }
        }
      } else if (detail.payload.body && detail.payload.body.data) {
        try {
          bodyText = decodeURIComponent(escape(atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))));
        } catch (e) {
          bodyText = bodySnippet;
        }
      }

      // Check if body holds some simple syntax layout e.g.:
      // TOPIC: Joule-Thomson
      // QUESTION: Define μ_JT
      // ANSWER: (dT/dP)_H
      // FORMULA: dT/dP
      let parsedCard;
      if (bodyText.includes('TOPIC:') && bodyText.includes('QUESTION:')) {
        const topicMatch = bodyText.match(/TOPIC:\s*(.*)/i);
        const questionMatch = bodyText.match(/QUESTION:\s*(.*)/i);
        const answerMatch = bodyText.match(/ANSWER:\s*(.*)/i);
        const formulaMatch = bodyText.match(/FORMULA:\s*(.*)/i);

        if (topicMatch && questionMatch) {
          parsedCard = {
            topic: topicMatch[1].trim(),
            question: questionMatch[1].trim(),
            expectedAnswerSummary: answerMatch ? answerMatch[1].trim() : 'Review in group chat summary.',
            formulaReference: formulaMatch ? formulaMatch[1].trim() : 'General Equation'
          };
        }
      }

      results.push({
        id: item.id,
        snippet: bodySnippet,
        subject: subject,
        body: bodyText,
        parsedCard: parsedCard
      });
    }
  }

  return results;
}

/**
 * 3. Saves or creates a backup state of student progression on Google Drive
 */
export async function backupDataToGoogleDrive(
  token: string,
  backupName: string,
  backupPayload: any
): Promise<string> {
  const metadata = {
    name: backupName,
    mimeType: 'application/json',
    description: 'PRO-ENG Technical Boards Study Deck Backup file'
  };

  const boundary = 'pro_eng_prep_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody = (
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(backupPayload) +
    closeDelimiter
  );

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Failed to create Drive backup:', errText);
    throw new Error('Google Drive upload failed: ' + errText);
  }

  const result = await response.json();
  return result.id;
}

/**
 * 4. List backup files from student's specific Drive files
 */
export async function listDriveBackupFiles(token: string): Promise<DriveBackupFile[]> {
  const query = encodeURIComponent("name contains 'pro_eng_prep_' and mimeType = 'application/json'");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime)&orderBy=createdTime%20desc`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Could not read Google Drive contents: ' + await response.text());
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * 5. Pulls backup file data and downloads contents
 */
export async function downloadBackupData(token: string, fileId: string): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Failed to retrieve file contents: ' + await response.text());
  }

  return response.json();
}
