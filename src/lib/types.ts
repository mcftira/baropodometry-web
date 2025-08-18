export type AppSettings = {
  apiKey?: string;
  model?: "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-3.5-turbo";
  vectorStoreId?: string;
  useAssistants?: boolean;
  language?: "English" | "Hungarian";
  assistantIdComparison?: string;
  assistantIdNormal?: string;
};


