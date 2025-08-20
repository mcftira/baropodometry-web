# Baropodometry Analyzer - System Workflow Documentation
## Updated: 2025-01-28

## 🎯 Overview
The Baropodometry Analyzer is a medical analysis system that processes PDF reports from baropodometric tests to extract metrics and provide clinical interpretations. The system uses OpenAI's Assistant API with specialized agents for different analysis modes.

## 📊 Current Active Assistants

### 1. **JSON Extractor (3-Stage Analysis)**
- **ID:** `asst_oyqcyehgTMdVMP8woEszylP7`
- **Purpose:** Extract metrics from 3 PDFs (NEUTRAL, CLOSED EYES, COTTON ROLLS)
- **Model:** gpt-4o-mini
- **Tools:** `code_interpreter` only (no vector store)
- **Output:** Strict JSON schema with all metrics
- **Temperature:** 0.2 (for consistent extraction)

### 2. **Comparison Expert (2-State Analysis)**
- **ID:** `asst_cNsh0SlF0GVgofnxr8Jplrmy`
- **Purpose:** Compare WITHOUT vs WITH device states
- **Model:** gpt-4o-mini
- **Tools:** `file_search`, `code_interpreter`
- **Output:** JSON with baseline, intervention, and comparison metrics

### 3. **Clinical Analyst (Text Output)**
- **ID:** `asst_rmV9q7qUkvCMmA8IBdBtlWPT`
- **Purpose:** Provide narrative clinical interpretations
- **Model:** gpt-4o-mini
- **Tools:** None (text-only analysis)
- **Temperature:** 0.7 (for natural text)
- **Status:** Available but not currently used in web app

## 🔄 Processing Workflow

### Web Application Flow

```mermaid
graph TD
    A[User Uploads 3 PDFs] --> B[Web Frontend - localhost:3001]
    B --> C[/api/analyze Route]
    C --> D{Select Mode}
    
    D -->|Normal Mode| E[JSON Extractor<br/>asst_oyqcyehgTMdVMP8woEszylP7]
    D -->|Comparison Mode| F[Comparison Expert<br/>asst_cNsh0SlF0GVgofnxr8Jplrmy]
    
    E --> G[Upload PDFs to OpenAI Files API]
    F --> G
    
    G --> H[Create Thread with Attachments]
    H --> I[Run Assistant with code_interpreter]
    I --> J[Process PDFs & Extract Data]
    
    J --> K{Parse Response}
    K -->|Valid JSON| L[Return Structured Data]
    K -->|Invalid JSON| M[Return Error]
    
    L --> N[Frontend Display]
    N --> O[Render Medical UI with Metrics]
    
    M --> P[Show Error Message]
```

### Detailed Processing Steps

1. **PDF Upload**
   - User selects 3 PDF files (NEUTRAL, CLOSED EYES, COTTON ROLLS)
   - Files are sent to `/api/analyze` endpoint as FormData
   - Mode is specified: "normal" or "comparison"

2. **File Processing**
   ```javascript
   // Convert to OpenAI file format
   const file = await openai.files.create({
     file: pdfBlob,
     purpose: "assistants"
   });
   ```

3. **Thread Creation**
   ```javascript
   const thread = await openai.beta.threads.create({
     messages: [{
       role: "user",
       content: "Analysis prompt...",
       attachments: [
         { file_id: neutralFile.id, tools: [{ type: "code_interpreter" }] },
         { file_id: closedFile.id, tools: [{ type: "code_interpreter" }] },
         { file_id: cottonFile.id, tools: [{ type: "code_interpreter" }] }
       ]
     }]
   });
   ```

4. **Assistant Execution**
   ```javascript
   const run = await openai.beta.threads.runs.createAndPoll(
     thread.id,
     { 
       assistant_id: assistantId,
       model: "gpt-4o-mini",
       tools: [{ type: "code_interpreter" }]
     }
   );
   ```

5. **Data Extraction**
   The assistant uses code_interpreter to:
   - Parse PDF text and tables
   - Extract numerical metrics
   - Calculate Romberg quotients (CLOSED EYES / NEUTRAL)
   - Compute Cotton effects (COTTON ROLLS / CLOSED EYES)
   - Generate structured JSON response

6. **Response Handling**
   - Success: Parse JSON and return to frontend
   - Failure: Return error (no fallback to unstructured text)
   - Cleanup: Delete uploaded files after processing

## 📋 JSON Output Schema

### 3-Stage Analysis Output
```json
{
  "patient": {
    "name": "string|null",
    "dateTime": "string|null",
    "testDuration_sec": "number|null"
  },
  "stages": {
    "neutral": {
      "mainStabilometric": {
        "length_mm": "number|null",
        "area_mm2": "number|null",
        "velocity_mm_s": "number|null",
        "ls_ratio": "number|null",
        "ellipse_ratio": "number|null",
        "pressure_left_pct": "number|null",
        "pressure_right_pct": "number|null",
        "cop_x_mm": "number|null",
        "cop_y_mm": "number|null",
        "torsion_angle_deg": "number|null"
      },
      "footCenters": {
        "left": { "cop_length_mm", "cop_area_mm2", "cop_velocity_mm_s", "x_avg_mm", "y_avg_mm" },
        "right": { /* same structure */ }
      },
      "swayDensity": {
        "mp_sec", "sp_mm", "md_mm", "sd_mm", "mt_sec", "st_sec", "area"
      },
      "visualAnalysis": {
        "stabilogram": "IMAGE_NOT_EXTRACTED",
        "cop_velocity_graph": "IMAGE_NOT_EXTRACTED",
        /* other visual elements */
      },
      "provenance": {
        "first_page": "number|null",
        "foot_centers_page": "number|null",
        "sway_density_page": "number|null",
        "global_synthesis_page": "number|null"
      }
    },
    "closed_eyes": { /* same structure */ },
    "cotton_rolls": { /* same structure */ }
  },
  "comparisons": {
    "romberg": {
      "length": { "ratio": "number|null", "deltaPct": "number|null", "direction": "string" },
      "area": { /* same */ },
      "velocity": { /* same */ }
    },
    "cottonEffect": { /* same structure as romberg */ },
    "summary": "string|null",
    "confidence": "number|null"
  },
  "_warning": "string|null"
}
```

## 🚨 Error Handling

1. **Missing Files**: Returns 400 with "Missing PDF(s). 3 stages required."
2. **No API Key**: Returns 500 with "API key not configured"
3. **Assistant Not Found**: Returns 500 with assistant ID error
4. **Invalid JSON**: Returns 500 with parsing error (no fallback)
5. **Run Failed**: Returns 500 with OpenAI error message

## ⚙️ Configuration

### Environment Variables
```env
# .env.local (in baropodometry-web/)
OPENAI_API_KEY=sk-...
ASSISTANT_ID_EXTRACTOR=asst_oyqcyehgTMdVMP8woEszylP7
ASSISTANT_ID_ANALYST=asst_rmV9q7qUkvCMmA8IBdBtlWPT
ASSISTANT_ID_COMPARISON=asst_cNsh0SlF0GVgofnxr8Jplrmy
```

### Fallback Configuration
If environment variables are not set, the system falls back to:
1. `../Config/settings.json` for API key
2. Hardcoded assistant IDs in `server-config.ts`

## 🔧 Key Features

### ✅ Current Implementation
- Direct PDF processing without vector stores
- Strict JSON output validation
- No fallback to unstructured text
- Proper error handling and file cleanup
- Support for both 3-stage and 2-state comparison modes
- Rate limit optimization with gpt-4o-mini

### ❌ Removed Features
- Vector store RAG system (removed for simplicity)
- Fallback to unstructured text (removed to ensure consistency)
- Old duplicate assistants (cleaned up)

## 📝 Maintenance Notes

### Creating New Assistants
Run `python create_no_rag_assistants.py` in `baropodometry_agent/` to create new assistants.

### Deleting Old Assistants
Run `python delete_old_assistants.py` to clean up unused assistants.

### Inspecting Assistants
Run `python inspect_assistants.py` to list current assistants and their configurations.

## 🎯 Usage Instructions

1. **Start the Web Server**
   ```bash
   cd baropodometry-web
   npm run dev
   ```
   Server runs on http://localhost:3001

2. **Upload PDFs**
   - Navigate to the web interface
   - Upload 3 PDF files for the three stages
   - Select analysis mode (normal or comparison)

3. **View Results**
   - Structured metrics display
   - Clinical interpretations
   - Comparison calculations (Romberg & Cotton effects)

## 📊 Success Metrics

- **Extraction Accuracy**: JSON extractor successfully parses PDF tables and metrics
- **No Fallbacks**: System returns errors instead of degrading to unstructured output
- **Clean Architecture**: Single responsibility for each assistant
- **Performance**: Using gpt-4o-mini for better rate limits and cost efficiency

