import { Injectable } from "@nestjs/common";
import { roadmapSchemas } from "@develevate/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";

@Injectable()
export class RoadmapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService
  ) {}

  async create(userId: string, raw: unknown) {
    const input = roadmapSchemas.create.parse(raw);
    const fallback = createLocalRoadmap(input);
    const result = await this.ai.generateJson(
      "Create a career roadmap as JSON with milestones array. Include week, focus, deliverables, and metrics.",
      JSON.stringify(input),
      fallback
    );
    return this.prisma.roadmap.create({
      data: {
        userId,
        targetRole: input.targetRole,
        currentSkills: input.currentSkills,
        timelineWeeks: input.timelineWeeks,
        milestones: result.milestones
      }
    });
  }

  list(userId: string) {
    return this.prisma.roadmap.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }
}

function createLocalRoadmap(input: { targetRole: string; currentSkills: string[]; timelineWeeks: number }) {
  const weeks = Math.max(4, Math.min(16, input.timelineWeeks));
  const skills = input.currentSkills.length ? input.currentSkills : ["current experience"];
  const gaps = inferRoadmapGaps(input.targetRole, skills);
  const baseMilestones = buildRoleFamilyMilestones(input.targetRole, skills, gaps);

  return {
    milestones: baseMilestones.slice(0, weeks).map((milestone, index) => ({ week: index + 1, ...milestone }))
  };
}

function buildRoleFamilyMilestones(targetRole: string, skills: string[], gaps: string[]) {
  const role = targetRole || "target role";
  const normalized = role.toLowerCase();
  const anchorSkill = skills[0] ?? "current experience";
  const skillText = skills.slice(0, 3).join(", ");

  if (/(qa|test|quality|automation)/.test(normalized)) {
    return [
      {
        focus: `Audit release coverage for ${role}`,
        deliverables: [`Create a module-by-module test inventory from ${skillText}`, "Mark smoke, regression, and exploratory coverage separately", `Flag missing automation around ${gaps[0]}`],
        metrics: ["Coverage map has owner, risk, and automation status for each flow"]
      },
      {
        focus: "Build the first reliable automation suite",
        deliverables: [`Automate 3 critical paths using ${anchorSkill}`, "Add stable selectors, seeded data, and cleanup strategy", "Capture screenshots/logs on failure"],
        metrics: ["Suite passes 5 consecutive local and CI runs"]
      },
      {
        focus: "Define release-blocking quality gates",
        deliverables: ["Classify defects by severity and customer impact", "Write pass/fail criteria for release sign-off", `Add a gate for ${gaps[1]}`],
        metrics: ["Every release decision has explicit block/allow criteria"]
      },
      {
        focus: "Reduce flaky test risk",
        deliverables: ["Identify top flaky scenarios", "Separate product defects from unstable tests", "Document retry rules and root-cause fixes"],
        metrics: ["Flaky rate trends down over two test cycles"]
      },
      {
        focus: "Add CI reporting and defect analytics",
        deliverables: ["Publish test report in CI", "Track failed tests by feature and severity", "Create bug report template with reproduction evidence"],
        metrics: ["Failures are traceable to feature, severity, and owner"]
      },
      {
        focus: "Prepare QA interview proof",
        deliverables: ["Create a release-risk story", "Explain one automation tradeoff", "Rewrite resume bullets around coverage, CI, and defect prevention"],
        metrics: ["Story includes quantified coverage or defect reduction"]
      }
    ];
  }

  if (/(product manager|program manager|project manager|pm\b|scrum)/.test(normalized)) {
    return [
      {
        focus: `Discover the ${role} problem space`,
        deliverables: ["Write target user, pain point, and business goal", "Turn user stories into jobs-to-be-done", `Identify missing proof around ${gaps[0]}`],
        metrics: ["Problem brief states user, pain, value, and success metric"]
      },
      {
        focus: "Prioritize the first roadmap slice",
        deliverables: ["Build an impact/effort matrix", "Separate MVP, v1, and later scope", "Write tradeoff notes for rejected ideas"],
        metrics: ["Top 5 roadmap items have clear decision rationale"]
      },
      {
        focus: "Create a PRD and acceptance criteria",
        deliverables: [`Draft PRD using ${skillText}`, "Define personas, user flows, non-goals, and edge cases", "Add measurable launch criteria"],
        metrics: ["PRD is ready for engineering review"]
      },
      {
        focus: "Validate with stakeholders and users",
        deliverables: ["Prepare 5 discovery questions", "Summarize risks, objections, and assumptions", `Update scope based on ${gaps[1]}`],
        metrics: ["At least 3 insights change roadmap or requirements"]
      },
      {
        focus: "Define launch and adoption metrics",
        deliverables: ["Create metrics tree", "Map events to activation, retention, and quality", "Write post-launch readout template"],
        metrics: ["Launch dashboard answers whether the feature worked"]
      },
      {
        focus: "Prepare PM interview proof",
        deliverables: ["Create a product decision story", "Practice prioritization and execution answers", "Rewrite resume bullets around outcomes and stakeholder alignment"],
        metrics: ["Story connects decision, metric, tradeoff, and result"]
      }
    ];
  }

  if (/(data|analytics|analyst|bi)/.test(normalized)) {
    return [
      {
        focus: `Define the ${role} business question`,
        deliverables: ["Translate stakeholder ask into KPIs", `Map available skills ${skillText} to data tasks`, `Identify missing proof around ${gaps[0]}`],
        metrics: ["KPI definition includes grain, source, and owner"]
      },
      {
        focus: "Clean and model the dataset",
        deliverables: ["Handle missing values, duplicates, and outliers", "Create repeatable SQL/Python transformation steps", "Document data assumptions"],
        metrics: ["Dataset passes completeness and consistency checks"]
      },
      {
        focus: "Build the insight dashboard",
        deliverables: ["Create trend, segment, and comparison views", "Add filters tied to the business question", "Annotate one surprising insight"],
        metrics: ["Dashboard answers 3 stakeholder questions"]
      },
      {
        focus: "Validate analysis quality",
        deliverables: ["Reconcile totals against source data", "Test edge cases and metric definitions", `Add checks for ${gaps[1]}`],
        metrics: ["Metric variance is explained or corrected"]
      },
      {
        focus: "Tell the decision story",
        deliverables: ["Write executive summary", "Separate observation, interpretation, and recommendation", "Add next-action owner"],
        metrics: ["Stakeholder can act on the recommendation"]
      },
      {
        focus: "Prepare analyst interview proof",
        deliverables: ["Create a portfolio case study", "Practice SQL and metric tradeoff questions", "Rewrite resume bullets with KPI impact"],
        metrics: ["Case study includes business question, method, and result"]
      }
    ];
  }

  if (/(devops|sre|cloud|platform|infrastructure)/.test(normalized)) {
    return [
      {
        focus: `Baseline ${role} reliability posture`,
        deliverables: ["Inventory services, environments, and deployment steps", `Map ${skillText} to CI/CD and runtime ownership`, `Identify missing proof around ${gaps[0]}`],
        metrics: ["Runbook lists deploy, rollback, and health checks"]
      },
      {
        focus: "Containerize and standardize local setup",
        deliverables: ["Create Docker-based app startup", "Document env vars and dependency checks", "Add one-command health verification"],
        metrics: ["Fresh setup works from README"]
      },
      {
        focus: "Build CI/CD quality gates",
        deliverables: ["Run typecheck, tests, and build in CI", "Cache dependencies safely", "Block deploy on failed checks"],
        metrics: ["CI catches a broken build before deployment"]
      },
      {
        focus: "Add monitoring and incident signals",
        deliverables: ["Define uptime, latency, error-rate, and saturation signals", "Create alert thresholds", "Write incident triage steps"],
        metrics: ["Alert maps to clear owner and response action"]
      },
      {
        focus: "Practice rollback and recovery",
        deliverables: ["Simulate failed deploy", "Document rollback command", `Add mitigation for ${gaps[1]}`],
        metrics: ["Recovery plan restores service within target time"]
      },
      {
        focus: "Prepare platform interview proof",
        deliverables: ["Create architecture/runbook walkthrough", "Practice incident-response story", "Rewrite resume bullets around reliability outcomes"],
        metrics: ["Story includes impact, detection, mitigation, and prevention"]
      }
    ];
  }

  if (/(marketing|growth|content|seo|social media|campaign)/.test(normalized)) {
    return [
      {
        focus: `Define the ${role} audience and funnel`,
        deliverables: [`Map target audience, pain points, and buying stage using ${skillText}`, "Pick one funnel goal: awareness, lead capture, activation, or retention", `Identify missing proof around ${gaps[0]}`],
        metrics: ["Campaign brief includes audience, channel, offer, and KPI"]
      },
      {
        focus: "Build a campaign content system",
        deliverables: [`Create 3 content assets using ${anchorSkill}`, "Write channel-specific hooks and CTAs", "Prepare a publishing calendar across email/social/search"],
        metrics: ["Content calendar covers 2 weeks and 3 channels"]
      },
      {
        focus: "Set up measurement and attribution",
        deliverables: ["Define UTM naming, conversion events, and dashboard fields", "Connect Google Analytics or campaign exports to weekly reporting", `Track ${gaps[1]} as a campaign signal`],
        metrics: ["Report shows traffic, CTR, conversion, and top channel"]
      },
      {
        focus: "Optimize campaign performance",
        deliverables: ["Review engagement and conversion drop-offs", "A/B test one headline, CTA, or audience segment", "Document what changed and why"],
        metrics: ["One experiment has hypothesis, result, and next action"]
      },
      {
        focus: "Create marketing portfolio proof",
        deliverables: ["Turn the campaign into a case study", "Show before/after metrics and screenshots", "Rewrite resume bullets around conversion or engagement impact"],
        metrics: ["Case study proves campaign thinking and measurable result"]
      },
      {
        focus: "Prepare marketing interview proof",
        deliverables: ["Practice campaign strategy question", "Practice analytics tradeoff question", "Prepare a failed-campaign recovery story"],
        metrics: ["Story connects audience, channel, metric, and business outcome"]
      }
    ];
  }

  if (/(sales|account|business development|customer success|revenue)/.test(normalized)) {
    return [
      {
        focus: `Map ${role} revenue motion`,
        deliverables: [`Define ICP, buyer pain, and qualification criteria using ${skillText}`, "Create pipeline stages and exit criteria", `Identify missing proof around ${gaps[0]}`],
        metrics: ["Account plan names ICP, pain, trigger, and next step"]
      },
      {
        focus: "Build outreach and discovery proof",
        deliverables: ["Write 3 personalized outreach messages", "Prepare discovery questions by buyer role", "Create objection-handling notes"],
        metrics: ["Outreach set covers value prop, proof, and CTA"]
      },
      {
        focus: "Track pipeline quality",
        deliverables: ["Create CRM fields for stage, source, next action, and risk", "Measure reply rate, meeting conversion, and stalled deals", `Track ${gaps[1]} as a qualification signal`],
        metrics: ["Pipeline report separates activity from quality"]
      },
      {
        focus: "Improve customer handoff and retention",
        deliverables: ["Write handoff checklist", "Define success criteria after close", "Document churn or expansion signals"],
        metrics: ["Customer handoff has owner, timeline, and success metric"]
      },
      {
        focus: "Create revenue portfolio proof",
        deliverables: ["Turn a prospect/account workflow into a case study", "Show conversion or retention metric", "Rewrite resume bullets around pipeline or customer impact"],
        metrics: ["Case study proves revenue process and measurable outcome"]
      },
      {
        focus: "Prepare sales interview proof",
        deliverables: ["Practice discovery call story", "Practice objection-handling answer", "Prepare a missed-deal learning story"],
        metrics: ["Story connects customer pain, action, metric, and lesson"]
      }
    ];
  }

  if (/(design|designer|ux|ui\/ux|researcher)/.test(normalized)) {
    return [
      { focus: `Understand the ${role} user problem`, deliverables: [`Create personas and task flows using ${skillText}`, "Audit competing experiences", `Identify missing proof around ${gaps[0]}`], metrics: ["Design brief includes user, problem, context, and success metric"] },
      { focus: "Create wireframes and interaction flows", deliverables: ["Sketch low-fidelity flows", "Define empty, loading, error, and success states", "Map accessibility concerns"], metrics: ["Prototype covers primary flow and two edge cases"] },
      { focus: "Validate design decisions", deliverables: ["Run usability review with 3 users or peers", "Capture friction points", `Revise flow based on ${gaps[1]}`], metrics: ["At least 3 issues are resolved with evidence"] },
      { focus: "Build portfolio-ready case study", deliverables: ["Show problem, constraints, iterations, and final design", "Add before/after screenshots", "Write measurable impact or usability signal"], metrics: ["Case study explains decisions, not only visuals"] }
    ];
  }

  if (/(hr|human resources|recruiter|talent acquisition|people operations)/.test(normalized)) {
    return [
      { focus: `Map the ${role} hiring or people process`, deliverables: [`Document current workflow using ${skillText}`, "Identify candidate/employee friction points", `Prioritize missing proof around ${gaps[0]}`], metrics: ["Process map includes stages, owner, SLA, and risk"] },
      { focus: "Create structured evaluation materials", deliverables: ["Build scorecard or policy checklist", "Define consistent decision criteria", "Add compliance and bias-risk notes"], metrics: ["Scorecard supports fair and repeatable decisions"] },
      { focus: "Improve pipeline or employee experience", deliverables: ["Draft communication templates", "Track response time and drop-off", `Add improvement plan for ${gaps[1]}`], metrics: ["Workflow improves speed, quality, or experience metric"] },
      { focus: "Prepare HR portfolio proof", deliverables: ["Turn workflow into a case study", "Add metrics such as time-to-fill, retention, or satisfaction", "Rewrite resume bullets around people/process impact"], metrics: ["Case study connects process change to measurable outcome"] }
    ];
  }

  if (/(finance|financial|accounting|accountant|bookkeeper|audit|tax)/.test(normalized)) {
    return [
      { focus: `Baseline ${role} reporting responsibilities`, deliverables: [`Map reports, controls, and deadlines using ${skillText}`, "Identify reconciliation or compliance risks", `Prioritize missing proof around ${gaps[0]}`], metrics: ["Reporting checklist has source, owner, due date, and control"] },
      { focus: "Build a reconciliation workflow", deliverables: ["Create sample ledger or transaction review", "Flag mismatches and exception categories", "Document approval path"], metrics: ["Workflow explains variance, correction, and audit trail"] },
      { focus: "Create decision-ready financial analysis", deliverables: ["Build budget, forecast, or variance view", "Explain assumptions clearly", `Add analysis around ${gaps[1]}`], metrics: ["Analysis supports one business decision"] },
      { focus: "Prepare finance proof package", deliverables: ["Turn analysis into a portfolio case", "Add accuracy, timeliness, or savings metric", "Rewrite resume bullets around controls and business impact"], metrics: ["Case study shows financial judgment and measurable result"] }
    ];
  }

  if (/(nurse|healthcare|clinical|medical|pharmacy|patient care)/.test(normalized)) {
    return [
      { focus: `Map ${role} patient or clinical workflow`, deliverables: [`Document intake, care, handoff, and follow-up steps using ${skillText}`, "Identify safety and compliance risks", `Prioritize missing proof around ${gaps[0]}`], metrics: ["Workflow names patient risk, owner, and escalation path"] },
      { focus: "Strengthen protocol and documentation evidence", deliverables: ["Create checklist for a common scenario", "Practice accurate notes and handoff language", "Include privacy and safety considerations"], metrics: ["Checklist reduces missed steps in the scenario"] },
      { focus: "Improve patient or operational outcome", deliverables: ["Define one measurable care/process metric", `Build improvement plan around ${gaps[1]}`, "Document barriers and mitigation"], metrics: ["Plan ties action to safety, timeliness, or quality metric"] },
      { focus: "Prepare healthcare interview proof", deliverables: ["Create patient-safety or process-improvement story", "Practice ethics and prioritization answers", "Rewrite resume bullets around quality outcomes"], metrics: ["Story shows judgment, communication, and measurable impact"] }
    ];
  }

  if (/(teacher|educator|instructional|learning|trainer|curriculum)/.test(normalized)) {
    return [
      { focus: `Define ${role} learner outcomes`, deliverables: [`Map learners, goals, and constraints using ${skillText}`, "Create assessment criteria", `Identify missing proof around ${gaps[0]}`], metrics: ["Learning plan connects objective, activity, and assessment"] },
      { focus: "Build instructional materials", deliverables: ["Create lesson/module outline", "Add practice, feedback, and differentiation", "Prepare supporting slides or worksheet"], metrics: ["Material supports at least 3 learner needs"] },
      { focus: "Measure learning effectiveness", deliverables: ["Collect quiz, rubric, or feedback data", `Adjust instruction based on ${gaps[1]}`, "Document improvement actions"], metrics: ["Learner outcome or engagement metric improves"] },
      { focus: "Prepare education portfolio proof", deliverables: ["Create teaching/training case study", "Add assessment results or learner feedback", "Rewrite resume bullets around learning outcomes"], metrics: ["Case study shows instructional decision and result"] }
    ];
  }

  if (/(operations|supply chain|logistics|procurement|warehouse|inventory)/.test(normalized)) {
    return [
      { focus: `Map ${role} operating workflow`, deliverables: [`Document process steps, handoffs, and bottlenecks using ${skillText}`, "Identify delay, cost, or quality risks", `Prioritize missing proof around ${gaps[0]}`], metrics: ["Workflow includes cycle time, owner, and failure point"] },
      { focus: "Improve process control", deliverables: ["Create SOP or checklist", "Define exception handling and escalation", "Track throughput or defect categories"], metrics: ["SOP reduces rework or missed handoffs"] },
      { focus: "Build reporting and optimization proof", deliverables: ["Create inventory, SLA, or vendor performance report", `Analyze impact of ${gaps[1]}`, "Recommend one process change"], metrics: ["Recommendation ties to cost, speed, or quality metric"] },
      { focus: "Prepare operations interview proof", deliverables: ["Create process-improvement story", "Practice tradeoff between speed, cost, and quality", "Rewrite resume bullets around operational impact"], metrics: ["Story shows measurable process improvement"] }
    ];
  }

  if (/(cyber|security|soc|information security|iam|governance|grc)/.test(normalized)) {
    return [
      { focus: `Baseline ${role} security scope`, deliverables: [`Map assets, identities, threats, and controls using ${skillText}`, "Identify highest-risk gaps", `Prioritize missing proof around ${gaps[0]}`], metrics: ["Risk register includes impact, likelihood, owner, and mitigation"] },
      { focus: "Build detection or control evidence", deliverables: ["Create sample alert, policy, or access review", "Document false positive and escalation handling", "Map control to business risk"], metrics: ["Control has clear trigger, response, and audit trail"] },
      { focus: "Practice incident and compliance response", deliverables: ["Write incident timeline", `Add mitigation plan for ${gaps[1]}`, "Prepare post-incident prevention notes"], metrics: ["Response plan covers detect, contain, recover, and prevent"] },
      { focus: "Prepare security interview proof", deliverables: ["Create security case study", "Practice threat modeling or GRC scenario", "Rewrite resume bullets around risk reduction"], metrics: ["Story includes risk, action, control, and measurable result"] }
    ];
  }

  const capability = extractRoleCapability(role);
  return [
    {
      focus: `Map ${role} outcomes`,
      deliverables: [`Extract repeated outcomes from 3 ${role} job descriptions`, `Compare ${skillText} against ${capability} expectations`, `Prioritize missing proof around ${gaps[0]}`],
      metrics: [`Outcome map names ${role} responsibilities, proof gaps, and success measures`]
    },
    {
      focus: `Build ${capability} proof`,
      deliverables: [`Create a ${capability} case study for a realistic ${role} scenario`, `Use ${anchorSkill} as the starting advantage`, "Document context, decision, stakeholder, and result"],
      metrics: [`Case study proves ${capability} with measurable evidence`]
    },
    {
      focus: `Strengthen ${gaps[1]} with practice`,
      deliverables: [`Complete one scenario where ${role} decisions affect quality, cost, speed, or customer impact`, `Record assumptions and tradeoffs around ${gaps[1]}`, "Write what failure would look like and how to recover"],
      metrics: ["Scenario answer includes constraint, action, tradeoff, and success metric"]
    },
    {
      focus: `Package ${role} evidence`,
      deliverables: [`Review the case study against target ${role} job descriptions`, "Remove weak or unrelated claims", `Rewrite resume bullet around ${anchorSkill}, ${gaps[0]}, and measurable outcome`],
      metrics: ["Final proof reads specific to the selected role and skills"]
    }
  ];
}

function inferRoadmapGaps(targetRole: string, currentSkills: string[]) {
  const normalizedRole = targetRole.toLowerCase();
  const owned = new Set(currentSkills.map((skill) => skill.toLowerCase()));
  const requirements = getRoadmapRequirements(normalizedRole);
  const missing = requirements.filter((skill) => ![...owned].some((current) => current.includes(skill.toLowerCase()) || skill.toLowerCase().includes(current)));
  return [...missing, ...requirements].slice(0, 6);
}

function getRoadmapRequirements(role: string) {
  if (/(qa|test|quality|automation)/.test(role)) return ["test automation", "regression strategy", "flaky test analysis", "release risk", "coverage planning", "bug triage"];
  if (/(product manager|program manager|project manager|pm\b|scrum)/.test(role)) return ["prioritization", "user research", "metrics", "roadmapping", "stakeholder alignment", "launch planning"];
  if (/(frontend|front-end|react|ui|web)/.test(role)) return ["accessibility", "state management", "performance", "testing", "responsive design", "API integration"];
  if (/(backend|back-end|api|server|node|java|spring|nestjs)/.test(role)) return ["API design", "database modeling", "authentication", "caching", "observability", "reliability"];
  if (/(data|analytics|analyst|bi)/.test(role)) return ["SQL", "data visualization", "statistical thinking", "business metrics", "dashboard storytelling", "data quality"];
  if (/(devops|sre|cloud|platform|infrastructure)/.test(role)) return ["CI/CD", "monitoring", "incident response", "infrastructure as code", "containers", "deployment rollback"];
  if (/(marketing|growth|content|seo|social media|campaign)/.test(role)) return ["campaign strategy", "audience targeting", "conversion analytics", "SEO/content planning", "A/B testing", "funnel optimization"];
  if (/(sales|account|business development|customer success|revenue)/.test(role)) return ["pipeline management", "discovery", "qualification", "objection handling", "customer handoff", "retention metrics"];
  if (/(design|designer|ux|ui\/ux|researcher)/.test(role)) return ["user research", "interaction design", "accessibility", "prototyping", "usability testing", "design systems"];
  if (/(hr|human resources|recruiter|talent acquisition|people operations)/.test(role)) return ["candidate experience", "structured interviews", "pipeline reporting", "compliance", "employee engagement", "process improvement"];
  if (/(finance|financial|accounting|accountant|bookkeeper|audit|tax)/.test(role)) return ["financial reporting", "reconciliation", "forecasting", "controls", "variance analysis", "audit readiness"];
  if (/(nurse|healthcare|clinical|medical|pharmacy|patient care)/.test(role)) return ["patient safety", "clinical documentation", "care coordination", "compliance", "quality improvement", "handoff communication"];
  if (/(teacher|educator|instructional|learning|trainer|curriculum)/.test(role)) return ["learning outcomes", "curriculum design", "assessment", "learner engagement", "feedback loops", "differentiation"];
  if (/(operations|supply chain|logistics|procurement|warehouse|inventory)/.test(role)) return ["process mapping", "SOP design", "inventory accuracy", "vendor coordination", "cycle-time reduction", "quality control"];
  if (/(cyber|security|soc|information security|iam|governance|grc)/.test(role)) return ["risk assessment", "threat modeling", "access control", "incident response", "compliance evidence", "control monitoring"];
  const capability = extractRoleCapability(role);
  return [`${capability} evidence`, `${capability} workflow`, "stakeholder communication", "measurable outcomes", "risk handling", "case study proof"];
}

function extractRoleCapability(role: string) {
  const cleaned = role
    .replace(/\b(senior|junior|lead|principal|associate|entry level|manager|specialist|engineer|developer|analyst|coordinator|assistant)\b/gi, "")
    .trim()
    .toLowerCase();
  const words = cleaned.split(/\s+/).filter((word) => word.length > 2).slice(0, 3);
  return words.length ? words.join(" ") : role.toLowerCase();
}
