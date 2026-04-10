<div align="center">

# UNICC AI Safety Governance Platform

### Comprehensive AI Safety Assessment & Governance System

</div>

---

## Overview

The **UNICC AI Safety Governance Platform** is a robust solution designed to manage the lifecycle of AI model safety. It provides tools for risk assessment, automated evaluation, human-in-the-loop review (ASRB), and live monitoring of AI systems.

## Key Features

- **📊 Centralized Dashboard**: Real-time overview of total assessments, high-risk models, and pending reviews.
- **🛡️ Risk Assessment**: Detailed questionnaires to classify AI model risks (Low, Medium, High, Critical) based on potential impact and data sensitivity.
- **🤖 Automated Evaluator**: Integration with Google GenAI to automatically score and evaluate model responses against safety checklists.
- **👥 ASRB Review Workflow**: Dedicated interface for the AI Safety Review Board to approve or reject models with detailed feedback.
- **📈 Live Monitoring**: Real-time tracking of requests, violations, and latency for deployed models.
- **📑 Comprehensive Reporting**: Generate and export detailed PDF reports for audit trails and compliance.

## Tech Stack

- **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI Integration**: [Google GenAI SDK](https://github.com/google/google-api-nodejs-client)
- **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/RyanYang1390/unicc-ai-safety-sandbox-final.git
    cd unicc-ai-safety-sandbox-final
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    - Create a `.env.local` file in the root directory.
    - Add your Gemini API key:
      ```env
      VITE_GEMINI_API_KEY=your_api_key_here
      ```

### Running the App

Start the development server:

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173` (or the port shown in your terminal).

## License

Private - UNICC AI Safety Sandbox
