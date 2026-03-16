# CERNIQ Frontend UX Simplification Prompt

> Internal guide for structuring the frontend workflow.

## Core Workflow

Design the CERNIQ interface so the core workflow is obvious:

1. **Upload Institution Data**
2. **Run ALM Engine**
3. **Review Results**
4. **Generate Report**

Each step must feel like a guided institutional process.

## Pipeline Structure

Avoid dashboard clutter. Structure the product around a workflow pipeline:

```
DATA INGESTION
     ↓
  VALIDATION
     ↓
  ANALYSIS
     ↓
REPORT OUTPUT
```

## Rules

- Users should never feel lost in the system.
- Each step should have a clear "next action" button.
- Progress indicators should show where the user is in the pipeline.
- Error states should explain what went wrong and how to fix it.
- The interface should work for someone who has never used financial software.

## Anti-Patterns

- ❌ Exposing 10+ navigation items on first login
- ❌ Dashboards with charts before the user has uploaded data
- ❌ Settings pages that overwhelm with configuration
- ❌ Multiple competing workflows visible simultaneously
