import type { Surface } from "./types";
export const surfaceLabels: Record<Surface, string> = {
  FG: "Firm ground",
  AG: "Artificial grass",
  SG: "Soft ground",
  TF: "Turf",
};

// Supported preference choices; product records themselves come from PostgreSQL.
export const preferenceBrands=[{id:"nike",name:"Nike"},{id:"adidas",name:"adidas"},{id:"puma",name:"PUMA"},{id:"mizuno",name:"Mizuno"}];
export const preferenceTiers=["Elite","Pro","Academy"];
