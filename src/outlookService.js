// outlookService.js
// Servis za prijavo in branje emailov iz Outlooka preko Microsoft Graph API

import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginRequest, graphConfig } from "./msalConfig";

// Globalna instanca MSAL
export const msalInstance = new PublicClientApplication(msalConfig);

// Inicializacija ob zagonu aplikacije
let initialized = false;
export async function initializeMsal() {
  if (!initialized) {
    await msalInstance.initialize();
    initialized = true;
  }
}

// Prijava z Microsoft računom
export async function loginToOutlook() {
  await initializeMsal();
  try {
    const loginResponse = await msalInstance.loginPopup(loginRequest);
    msalInstance.setActiveAccount(loginResponse.account);
    return loginResponse.account;
  } catch (error) {
    console.error("Napaka pri prijavi:", error);
    throw error;
  }
}

// Odjava
export async function logoutFromOutlook() {
  await initializeMsal();
  const account = msalInstance.getActiveAccount();
  if (account) {
    await msalInstance.logoutPopup({ account });
  }
}

// Vrne trenutno prijavljen Microsoft račun (če obstaja)
export function getActiveAccount() {
  return msalInstance.getActiveAccount();
}

// Pridobi access token za klice na Microsoft Graph API
async function getAccessToken() {
  await initializeMsal();
  const account = msalInstance.getActiveAccount();
  if (!account) {
    throw new Error("Ni prijavljenega Microsoft računa");
  }
  
  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    return response.accessToken;
  } catch (error) {
    console.warn("Silent token failed, falling back to popup:", error);
    const response = await msalInstance.acquireTokenPopup(loginRequest);
    return response.accessToken;
  }
}

// Pridobi seznam zadnjih emailov iz inboxa
export async function getRecentEmails(limit = 25) {
  const token = await getAccessToken();
  
  const url = `${graphConfig.graphMailEndpoint}?$top=${limit}&$select=id,subject,from,receivedDateTime,hasAttachments,bodyPreview,isRead&$orderby=receivedDateTime desc`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Napaka pri branju emailov: ${response.status} ${errText}`);
  }
  
  const data = await response.json();
  return data.value || [];
}

// Pridobi celoten email s prilogami
export async function getEmailWithAttachments(messageId) {
  const token = await getAccessToken();
  
  const emailUrl = `${graphConfig.graphMailEndpoint}/${messageId}`;
  const emailRes = await fetch(emailUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!emailRes.ok) {
    throw new Error(`Napaka pri branju emaila: ${emailRes.status}`);
  }
  
  const email = await emailRes.json();
  
  let attachments = [];
  if (email.hasAttachments) {
    const attachmentsUrl = `${graphConfig.graphMailEndpoint}/${messageId}/attachments`;
    const attRes = await fetch(attachmentsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (attRes.ok) {
      const attData = await attRes.json();
      attachments = attData.value || [];
    }
  }
  
  return { email, attachments };
}

// Ustvari osnutek maila naročniku s priloženim originalnim nalogom
export async function ustvariOsnutekZaNarocnika({ prejemnik, zadeva, telo, pdfUrl, pdfIme }) {
  const token = await getAccessToken();
  const attachments = [];
  if (pdfUrl) {
    try {
      const r = await fetch(pdfUrl);
      if (r.ok) {
        const buf = await r.arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        attachments.push({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: pdfIme || "nalog.pdf",
          contentType: "application/pdf",
          contentBytes: btoa(bin),
        });
      }
    } catch (e) {
      console.warn("Priloge ni bilo mogoce prenesti:", e);
    }
  }
  const res = await fetch(graphConfig.graphMailEndpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: zadeva,
      body: { contentType: "Text", content: telo },
      toRecipients: prejemnik ? [{ emailAddress: { address: prejemnik } }] : [],
      attachments,
    }),
  });
  if (!res.ok) throw new Error("Graph napaka " + res.status + ": " + (await res.text()).slice(0, 200));
  const msg = await res.json();
  return { webLink: msg.webLink, id: msg.id, priponka: attachments.length > 0 };
}

// Označi email kot prebran (po uvozu naloga)
export async function markEmailAsRead(messageId) {
  const token = await getAccessToken();
  
  const url = `${graphConfig.graphMailEndpoint}/${messageId}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ isRead: true }),
  });
  
  return response.ok;
}