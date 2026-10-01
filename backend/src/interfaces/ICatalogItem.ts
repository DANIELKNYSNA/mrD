export interface ICatalogItem {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  /** 0–100 score used for the popularity sort. */
  popularity: number;
}
