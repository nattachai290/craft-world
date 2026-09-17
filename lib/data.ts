import raw from "@/data/prices.json";
import type { PriceData } from "./types";

/** ราคา snapshot + ตารางโรงงานทุกเลเวล (ดึงจาก rawrtools.com / craft-world.gg) */
export const DATA = raw as unknown as PriceData;
