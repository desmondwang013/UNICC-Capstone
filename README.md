# UNICC AI Safety Lab – Project 1: Research and Platform Preparation

## Overview
This repository contains the Project 1 work for the UNICC AI Safety Lab capstone. The purpose of Project 1 is to establish the research foundation, system architecture, platform assumptions, and technical specifications needed to support a standalone small language model (SLM)-based AI safety evaluation system.

The broader AI Safety Lab project aims to integrate the top three Fall 2025 AI safety solutions into a unified multi-module inference ensemble that functions as a council of experts for evaluating AI agents before deployment. Project 1 focuses on the groundwork required to make that integration possible. Specifically, this work analyzes the prior solutions, defines the proposed architecture, identifies the responsibilities of each module, outlines the orchestration logic that will coordinate them, and documents how the system could be prepared for deployment on the NYU DGX Spark cluster. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1} :contentReference[oaicite:2]{index=2} :contentReference[oaicite:3]{index=3}

## Project 1 Scope
Project 1 is responsible for the following:

- researching multi-module inference ensembles, council-of-experts systems, and governance-aligned AI evaluation approaches
- analyzing the top three Fall 2025 UNICC AI safety solutions
- defining the system architecture for the new AI Safety Lab
- specifying the responsibilities of the three expert modules
- defining a shared input/output schema for module interoperability
- drafting orchestration logic for critique, arbitration, and synthesis
- preparing a Functional Requirements Specification (FRS)
- documenting DGX cluster assumptions and deployment procedures
- recommending a suitable open-source standalone SLM
- defining the environment, dependencies, and configuration requirements for future implementation

## Why This Repository Exists
The AI Safety Lab is a team project divided into three capstone parts:

- **Project 1:** Research and Platform Preparation
- **Project 2:** Fine-Tuning the SLM and Building the Council of Experts
- **Project 3:** Testing, User Experience, and Integration

This repository exists to provide the technical blueprint and platform planning needed for Projects 2 and 3. In other words, this repository answers the questions:

- What are we building?
- What are the three expert modules?
- How will they interact?
- What should run on the DGX cluster?
- What specifications and assumptions should guide implementation?

## Repository Structure

### Research and analysis
- research summary
- comparison of the Fall 2025 solutions

### Architecture and design
- system architecture
- module responsibilities
- shared input/output schema
- orchestration logic
- FRS draft

### Platform planning
- DGX setup assumptions
- SLM selection
- environment requirements
- deployment procedure

### Project tracking
- weekly status log

## Relationship to Prior Fall 2025 Solutions
This repository builds on the top three Fall 2025 solutions:

- **Jitong Yu:** rule-driven Safety Agent, semantic triggers, adaptive adversarial probing, and transcript-based state-machine logic :contentReference[oaicite:4]{index=4}
- **Ning Sun:** testing interface, user workflow, dashboarding, PDF reporting, and structured operational evaluation process :contentReference[oaicite:5]{index=5}
- **Guo et al.:** Petri-based LLM-as-judge evaluation architecture, governance-aligned scoring, and repeatable evaluation workflow :contentReference[oaicite:6]{index=6}

The current Project 1 work treats these as the starting point for a new multi-module system rather than as isolated prototypes.

## Expected Contribution of This Work
The main contribution of this repository is a clear, structured, implementation-ready first draft of the AI Safety Lab design. It is intended to:

- guide Project 2 in adapting expert modules to a standalone SLM
- guide Project 3 in building the integration and user experience layers
- ensure that the overall system remains modular, transparent, auditable, and aligned with the capstone memorandum and sponsor expectations :contentReference[oaicite:7]{index=7}

## Notes
This repository is a first-draft planning and design repo. It does not yet contain a full production implementation of the AI Safety Lab. Instead, it provides the architectural, platform, and specification artifacts needed to support that implementation in later project phases.
