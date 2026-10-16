export const rules = {
  version:"3.2.0",
  // Surface is only a safety gate; redistribute the original remaining 70 preference points.
  weights:{budget:25/70,fit:25/70,brandTier:15/70,other:5/70},
  maxCandidates:100,maxResults:20,maxEvidencePerVariant:32,
  priceMaxAgeDays:7,inventoryMaxAgeDays:1,surfaceMaxAgeDays:365,fitMaxAgeDays:365,
  nearBudgetRatio:1.1,
} as const;
export const surfaceGuidance = [
  "https://www.nike.com/au/football/shoe-guide",
  "https://www.adidas.com.au/blog/867677-how-to-buy-football-studs-fit-features-field-surface",
];
// Matrix is a conservative policy, not a universal manufacturer certification.
// Every cell still needs exact-variant manufacturer evidence; general labels never suffice.
export const prohibitedPairs = new Set(["SG:FG","SG:AG","SG:TF","SG:IN"]);
export const manufacturerHosts:Readonly<Record<string,readonly string[]>> = {
  nike:["nike.com"],adidas:["adidas.com","adidas.com.au"],puma:["puma.com"],mizuno:["mizuno.com"],
};
export function ascending(a:string,b:string){return a<b?-1:a>b?1:0;}
