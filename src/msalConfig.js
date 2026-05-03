// Microsoft Azure App konfiguracija za TransApp Email Reader
// Ti podatki povezujejo aplikacijo z Microsoft Graph API za branje Outlook emailov

export const msalConfig = {
  auth: {
    clientId: "d207f601-d935-450b-a085-b70017e98f44",
    authority: "https://login.microsoftonline.com/b0839ffc-f171-4dd9-a8dc-b2bdfff31e41",
    redirectUri: "http://localhost:5173",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

// Dovoljenja, ki jih bo aplikacija zahtevala od uporabnika ob prijavi
export const loginRequest = {
  scopes: ["User.Read", "Mail.Read", "Mail.ReadWrite"],
};

// Microsoft Graph API endpoint za emaile
export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
  graphMailEndpoint: "https://graph.microsoft.com/v1.0/me/messages",
};