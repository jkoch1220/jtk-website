import { kontakt } from "./kontakt";

// Strukturierte Daten (JSON-LD) für die Startseite: wer hinter der Website steht. Google nimmt daraus den
// Website-Namen über dem Suchtreffer und ordnet Firma, Person und Profile einander zu. Ein Ranking-Faktor
// ist das nicht, und alles hier muss auch sichtbar auf der Seite stehen. Deshalb ohne Straße und Postleitzahl:
// Die Adresse ist privat und steht nur im Impressum. Ohne volle Adresse passt Organization statt LocalBusiness.
// Prüfen nach jeder Änderung: https://validator.schema.org und https://search.google.com/test/rich-results
export function startseitenDaten(site: URL) {
  const url = site.href;
  const firma = { "@id": `${url}#firma` };
  const person = { "@id": `${url}#person` };
  const profile = kontakt.profile.length ? { sameAs: kontakt.profile } : {};

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        url,
        name: kontakt.firma,
        inLanguage: "de-DE",
        publisher: firma,
      },
      {
        "@type": "Organization",
        ...firma,
        name: kontakt.firma,
        url,
        ...(kontakt.telefonLink ? { telephone: kontakt.telefonLink.replace("tel:", "") } : {}),
        email: kontakt.email,
        address: {
          "@type": "PostalAddress",
          addressLocality: kontakt.ort,
          addressRegion: "Nordrhein-Westfalen",
          addressCountry: "DE",
        },
        areaServed: [
          { "@type": "City", name: "Düsseldorf" },
          { "@type": "AdministrativeArea", name: "Nordrhein-Westfalen" },
        ],
        founder: person,
        knowsAbout: [
          "Individuelle Software",
          "ERP-Systeme",
          "CRM-Systeme",
          "Schnittstellen",
          "KI-Automation",
          "KI-Telefonassistent",
          "E-Rechnung",
        ],
        ...profile,
      },
      {
        "@type": "Person",
        ...person,
        name: kontakt.name,
        alternateName: kontakt.nameVoll,
        jobTitle: "IT-Berater",
        worksFor: firma,
        ...profile,
      },
    ],
  };
}
