"use client";

import { useState } from "react";
import { CheckCircle2, Clipboard, Map } from "lucide-react";
import { api, getFriendlyErrorMessage } from "@/lib/api";
import { useSession } from "@/store/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Milestone = {
  week?: number;
  focus?: string;
  deliverables?: string[];
  metrics?: string[];
};

type Roadmap = {
  milestones: Milestone[];
};

export function RoadmapBuilder() {
  const accessToken = useSession((state) => state.accessToken);
  const mode = useSession((state) => state.mode);
  const [targetRole, setTargetRole] = useState("");
  const [currentSkills, setCurrentSkills] = useState("");
  const [roadmap, setRoadmap] = useState<Roadmap>();
  const [status, setStatus] = useState("Enter a target role and current skills to generate a personalized roadmap.");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");
  const [copiedRoadmap, setCopiedRoadmap] = useState(false);
  const [loading, setLoading] = useState(false);

  function useDemoRoadmap(message = "Local roadmap generated from your target role and skill gaps.") {
    setRoadmap({
      milestones: createLocalMilestones(targetRole.trim(), parseSkills(currentSkills), 12)
    });
    setStatus(message);
    setStatusTone("success");
  }

  async function generateRoadmap() {
    const skills = parseSkills(currentSkills);
    if (!targetRole.trim() || !skills.length) {
      setRoadmap(undefined);
      setStatus("Enter both target role and current skills before generating a roadmap.");
      setStatusTone("error");
      return;
    }
    if (!accessToken || mode !== "authenticated") {
      useDemoRoadmap("Local roadmap generated from your target role and skill gaps. Sign in with a running API to save it.");
      return;
    }
    setLoading(true);
    setStatus("Generating roadmap...");
    setStatusTone("info");
    try {
      const result = await api<Roadmap>("/roadmaps", {
        accessToken,
        method: "POST",
        body: JSON.stringify({
          targetRole: targetRole.trim(),
          currentSkills: skills,
          timelineWeeks: 12
        })
      });
      setRoadmap(result);
      setStatus("Roadmap saved to backend.");
      setStatusTone("success");
    } catch (error) {
      useDemoRoadmap(`${getFriendlyErrorMessage(error, "Backend unavailable.")} Showing local roadmap for now.`);
    } finally {
      setLoading(false);
    }
  }

  async function copyRoadmap() {
    if (!milestones.length) {
      setStatus("Generate a roadmap before copying it.");
      setStatusTone("error");
      return;
    }
    try {
      await navigator.clipboard.writeText(buildRoadmapReport(targetRole, parseSkills(currentSkills), milestones));
      setStatus("Roadmap plan copied.");
      setStatusTone("success");
      setCopiedRoadmap(true);
      window.setTimeout(() => setCopiedRoadmap(false), 2500);
    } catch {
      setCopiedRoadmap(false);
      setStatus("Could not copy automatically. Select the roadmap and copy it manually.");
      setStatusTone("error");
    }
  }

  const milestones = roadmap?.milestones ?? [];

  return (
    <section id="roadmap" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Map className="h-5 w-5 text-primary" />
          Career roadmap generator
        </h2>
        <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">
            <span className="mb-2 block">Target role</span>
            <Input aria-label="Target role" className="focus:ring-2" onChange={(event) => setTargetRole(event.target.value)} placeholder="Example: Senior Frontend Developer" value={targetRole} />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            <span className="mb-2 block">Current skills</span>
            <Input aria-label="Current skills" className="focus:ring-2" onChange={(event) => setCurrentSkills(event.target.value)} placeholder="Example: React, Next.js, TypeScript, PostgreSQL" value={currentSkills} />
          </label>
          <Button className="sm:col-span-2 sm:justify-self-end" disabled={loading} onClick={generateRoadmap}>
            {loading ? "Generating..." : "Generate"}
          </Button>
          <Button className="bg-muted text-foreground sm:col-span-2 sm:justify-self-end" disabled={!milestones.length} onClick={copyRoadmap} type="button">
            <Clipboard className="h-4 w-4" />
            {copiedRoadmap ? "Copied roadmap" : "Copy roadmap"}
          </Button>
        </div>
      </div>
      <Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {milestones.length ? (
            milestones.map((milestone, index) => (
              <div className="rounded-md border border-border p-4" key={`${milestone.week ?? index}-${milestone.focus}`}>
                <CheckCircle2 className="h-5 w-5 text-success" />
                <p className="mt-3 text-sm font-semibold">Week {milestone.week ?? index + 1}</p>
                <p className="mt-1 text-sm text-muted-foreground">{milestone.focus ?? milestone.deliverables?.[0] ?? "Career milestone"}</p>
                {!!milestone.deliverables?.length && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deliverables</p>
                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                      {milestone.deliverables.slice(0, 3).map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!milestone.metrics?.length && (
                  <div className="mt-3 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Metric: </span>
                    {milestone.metrics[0]}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
              No roadmap generated yet. Add the role you want, list your current skills, and click Generate.
            </div>
          )}
        </div>
        <p
          aria-live="polite"
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            statusTone === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : statusTone === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-border bg-muted text-muted-foreground"
          }`}
          role={statusTone === "error" ? "alert" : "status"}
        >
          {status}
        </p>
      </Card>
    </section>
  );
}

function parseSkills(value: string) {
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function createLocalMilestones(targetRole: string, currentSkills: string[], timelineWeeks: number): Milestone[] {
  const role = targetRole || "target role";
  const skills = currentSkills.length ? currentSkills : ["current experience"];
  const gaps = inferSkillGaps(role, skills);
  const plans = buildRoleFamilyRoadmapPlan(role, skills, gaps);

  return plans.slice(0, Math.max(4, Math.min(12, timelineWeeks))).map(([focus, deliverables, metrics], index) => ({
    week: index + 1,
    focus: focus as string,
    deliverables: deliverables as string[],
    metrics: metrics as string[]
  }));
}

function buildRoleFamilyRoadmapPlan(role: string, skills: string[], gaps: string[]) {
  const normalized = role.toLowerCase();
  const skillText = skills.slice(0, 3).join(", ");
  const primarySkill = skills[0] ?? "current experience";

  if (/(qa|test|quality|automation)/.test(normalized)) {
    return [
      [`Audit release coverage for ${role}`, [`Create a module-by-module test inventory from ${skillText}`, "Mark smoke, regression, and exploratory coverage separately", `Flag missing automation around ${gaps[0]}`], ["Coverage map has owner, risk, and automation status for each flow"]],
      ["Build the first reliable automation suite", [`Automate 3 critical paths using ${primarySkill}`, "Add stable selectors, seeded data, and cleanup strategy", "Capture screenshots/logs on failure"], ["Suite passes 5 consecutive local and CI runs"]],
      ["Define release-blocking quality gates", ["Classify defects by severity and customer impact", "Write pass/fail criteria for release sign-off", `Add a gate for ${gaps[1]}`], ["Every release decision has explicit block/allow criteria"]],
      ["Reduce flaky test risk", ["Identify top flaky scenarios", "Separate product defects from unstable tests", "Document retry rules and root-cause fixes"], ["Flaky rate trends down over two test cycles"]],
      ["Add CI reporting and defect analytics", ["Publish test report in CI", "Track failed tests by feature and severity", "Create bug report template with reproduction evidence"], ["Failures are traceable to feature, severity, and owner"]],
      ["Prepare QA interview proof", ["Create a release-risk story", "Explain one automation tradeoff", "Rewrite resume bullets around coverage, CI, and defect prevention"], ["Story includes quantified coverage or defect reduction"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(product manager|program manager|project manager|pm\b|scrum)/.test(normalized)) {
    return [
      [`Discover the ${role} problem space`, ["Write target user, pain point, and business goal", "Turn user stories into jobs-to-be-done", `Identify missing proof around ${gaps[0]}`], ["Problem brief states user, pain, value, and success metric"]],
      ["Prioritize the first roadmap slice", ["Build an impact/effort matrix", "Separate MVP, v1, and later scope", "Write tradeoff notes for rejected ideas"], ["Top 5 roadmap items have clear decision rationale"]],
      ["Create a PRD and acceptance criteria", [`Draft PRD using ${skillText}`, "Define personas, user flows, non-goals, and edge cases", "Add measurable launch criteria"], ["PRD is ready for engineering review"]],
      ["Validate with stakeholders and users", ["Prepare 5 discovery questions", "Summarize risks, objections, and assumptions", `Update scope based on ${gaps[1]}`], ["At least 3 insights change roadmap or requirements"]],
      ["Define launch and adoption metrics", ["Create metrics tree", "Map events to activation, retention, and quality", "Write post-launch readout template"], ["Launch dashboard answers whether the feature worked"]],
      ["Prepare PM interview proof", ["Create a product decision story", "Practice prioritization and execution answers", "Rewrite resume bullets around outcomes and stakeholder alignment"], ["Story connects decision, metric, tradeoff, and result"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(data|analytics|analyst|bi)/.test(normalized)) {
    return [
      [`Define the ${role} business question`, ["Translate stakeholder ask into KPIs", `Map available skills ${skillText} to data tasks`, `Identify missing proof around ${gaps[0]}`], ["KPI definition includes grain, source, and owner"]],
      ["Clean and model the dataset", ["Handle missing values, duplicates, and outliers", "Create repeatable SQL/Python transformation steps", "Document data assumptions"], ["Dataset passes completeness and consistency checks"]],
      ["Build the insight dashboard", ["Create trend, segment, and comparison views", "Add filters tied to the business question", "Annotate one surprising insight"], ["Dashboard answers 3 stakeholder questions"]],
      ["Validate analysis quality", ["Reconcile totals against source data", "Test edge cases and metric definitions", `Add checks for ${gaps[1]}`], ["Metric variance is explained or corrected"]],
      ["Tell the decision story", ["Write executive summary", "Separate observation, interpretation, and recommendation", "Add next-action owner"], ["Stakeholder can act on the recommendation"]],
      ["Prepare analyst interview proof", ["Create a portfolio case study", "Practice SQL and metric tradeoff questions", "Rewrite resume bullets with KPI impact"], ["Case study includes business question, method, and result"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(devops|sre|cloud|platform|infrastructure)/.test(normalized)) {
    return [
      [`Baseline ${role} reliability posture`, ["Inventory services, environments, and deployment steps", `Map ${skillText} to CI/CD and runtime ownership`, `Identify missing proof around ${gaps[0]}`], ["Runbook lists deploy, rollback, and health checks"]],
      ["Containerize and standardize local setup", ["Create Docker-based app startup", "Document env vars and dependency checks", "Add one-command health verification"], ["Fresh setup works from README"]],
      ["Build CI/CD quality gates", ["Run typecheck, tests, and build in CI", "Cache dependencies safely", "Block deploy on failed checks"], ["CI catches a broken build before deployment"]],
      ["Add monitoring and incident signals", ["Define uptime, latency, error-rate, and saturation signals", "Create alert thresholds", "Write incident triage steps"], ["Alert maps to clear owner and response action"]],
      ["Practice rollback and recovery", ["Simulate failed deploy", "Document rollback command", `Add mitigation for ${gaps[1]}`], ["Recovery plan restores service within target time"]],
      ["Prepare platform interview proof", ["Create architecture/runbook walkthrough", "Practice incident-response story", "Rewrite resume bullets around reliability outcomes"], ["Story includes impact, detection, mitigation, and prevention"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(marketing|growth|content|seo|social media|campaign)/.test(normalized)) {
    return [
      [`Define the ${role} audience and funnel`, [`Map target audience, pain points, and buying stage using ${skillText}`, "Pick one funnel goal: awareness, lead capture, activation, or retention", `Identify missing proof around ${gaps[0]}`], ["Campaign brief includes audience, channel, offer, and KPI"]],
      ["Build a campaign content system", [`Create 3 content assets using ${primarySkill}`, "Write channel-specific hooks and CTAs", "Prepare a publishing calendar across email/social/search"], ["Content calendar covers 2 weeks and 3 channels"]],
      ["Set up measurement and attribution", ["Define UTM naming, conversion events, and dashboard fields", "Connect Google Analytics or campaign exports to weekly reporting", `Track ${gaps[1]} as a campaign signal`], ["Report shows traffic, CTR, conversion, and top channel"]],
      ["Optimize campaign performance", ["Review engagement and conversion drop-offs", "A/B test one headline, CTA, or audience segment", "Document what changed and why"], ["One experiment has hypothesis, result, and next action"]],
      ["Create marketing portfolio proof", ["Turn the campaign into a case study", "Show before/after metrics and screenshots", "Rewrite resume bullets around conversion or engagement impact"], ["Case study proves campaign thinking and measurable result"]],
      ["Prepare marketing interview proof", ["Practice campaign strategy question", "Practice analytics tradeoff question", "Prepare a failed-campaign recovery story"], ["Story connects audience, channel, metric, and business outcome"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(sales|account|business development|customer success|revenue)/.test(normalized)) {
    return [
      [`Map ${role} revenue motion`, [`Define ICP, buyer pain, and qualification criteria using ${skillText}`, "Create pipeline stages and exit criteria", `Identify missing proof around ${gaps[0]}`], ["Account plan names ICP, pain, trigger, and next step"]],
      ["Build outreach and discovery proof", ["Write 3 personalized outreach messages", "Prepare discovery questions by buyer role", "Create objection-handling notes"], ["Outreach set covers value prop, proof, and CTA"]],
      ["Track pipeline quality", ["Create CRM fields for stage, source, next action, and risk", "Measure reply rate, meeting conversion, and stalled deals", `Track ${gaps[1]} as a qualification signal`], ["Pipeline report separates activity from quality"]],
      ["Improve customer handoff and retention", ["Write handoff checklist", "Define success criteria after close", "Document churn or expansion signals"], ["Customer handoff has owner, timeline, and success metric"]],
      ["Create revenue portfolio proof", ["Turn a prospect/account workflow into a case study", "Show conversion or retention metric", "Rewrite resume bullets around pipeline or customer impact"], ["Case study proves revenue process and measurable outcome"]],
      ["Prepare sales interview proof", ["Practice discovery call story", "Practice objection-handling answer", "Prepare a missed-deal learning story"], ["Story connects customer pain, action, metric, and lesson"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(design|designer|ux|ui\/ux|researcher)/.test(normalized)) {
    return [
      [`Understand the ${role} user problem`, [`Create personas and task flows using ${skillText}`, "Audit competing experiences", `Identify missing proof around ${gaps[0]}`], ["Design brief includes user, problem, context, and success metric"]],
      ["Create wireframes and interaction flows", ["Sketch low-fidelity flows", "Define empty, loading, error, and success states", "Map accessibility concerns"], ["Prototype covers primary flow and two edge cases"]],
      ["Validate design decisions", ["Run usability review with 3 users or peers", "Capture friction points", `Revise flow based on ${gaps[1]}`], ["At least 3 issues are resolved with evidence"]],
      ["Build portfolio-ready case study", ["Show problem, constraints, iterations, and final design", "Add before/after screenshots", "Write measurable impact or usability signal"], ["Case study explains decisions, not only visuals"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(hr|human resources|recruiter|talent acquisition|people operations)/.test(normalized)) {
    return [
      [`Map the ${role} hiring or people process`, [`Document current workflow using ${skillText}`, "Identify candidate/employee friction points", `Prioritize missing proof around ${gaps[0]}`], ["Process map includes stages, owner, SLA, and risk"]],
      ["Create structured evaluation materials", ["Build scorecard or policy checklist", "Define consistent decision criteria", "Add compliance and bias-risk notes"], ["Scorecard supports fair and repeatable decisions"]],
      ["Improve pipeline or employee experience", ["Draft communication templates", "Track response time and drop-off", `Add improvement plan for ${gaps[1]}`], ["Workflow improves speed, quality, or experience metric"]],
      ["Prepare HR portfolio proof", ["Turn workflow into a case study", "Add metrics such as time-to-fill, retention, or satisfaction", "Rewrite resume bullets around people/process impact"], ["Case study connects process change to measurable outcome"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(finance|financial|accounting|accountant|bookkeeper|audit|tax)/.test(normalized)) {
    return [
      [`Baseline ${role} reporting responsibilities`, [`Map reports, controls, and deadlines using ${skillText}`, "Identify reconciliation or compliance risks", `Prioritize missing proof around ${gaps[0]}`], ["Reporting checklist has source, owner, due date, and control"]],
      ["Build a reconciliation workflow", ["Create sample ledger or transaction review", "Flag mismatches and exception categories", "Document approval path"], ["Workflow explains variance, correction, and audit trail"]],
      ["Create decision-ready financial analysis", ["Build budget, forecast, or variance view", "Explain assumptions clearly", `Add analysis around ${gaps[1]}`], ["Analysis supports one business decision"]],
      ["Prepare finance proof package", ["Turn analysis into a portfolio case", "Add accuracy, timeliness, or savings metric", "Rewrite resume bullets around controls and business impact"], ["Case study shows financial judgment and measurable result"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(nurse|healthcare|clinical|medical|pharmacy|patient care)/.test(normalized)) {
    return [
      [`Map ${role} patient or clinical workflow`, [`Document intake, care, handoff, and follow-up steps using ${skillText}`, "Identify safety and compliance risks", `Prioritize missing proof around ${gaps[0]}`], ["Workflow names patient risk, owner, and escalation path"]],
      ["Strengthen protocol and documentation evidence", ["Create checklist for a common scenario", "Practice accurate notes and handoff language", "Include privacy and safety considerations"], ["Checklist reduces missed steps in the scenario"]],
      ["Improve patient or operational outcome", ["Define one measurable care/process metric", `Build improvement plan around ${gaps[1]}`, "Document barriers and mitigation"], ["Plan ties action to safety, timeliness, or quality metric"]],
      ["Prepare healthcare interview proof", ["Create patient-safety or process-improvement story", "Practice ethics and prioritization answers", "Rewrite resume bullets around quality outcomes"], ["Story shows judgment, communication, and measurable impact"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(teacher|educator|instructional|learning|trainer|curriculum)/.test(normalized)) {
    return [
      [`Define ${role} learner outcomes`, [`Map learners, goals, and constraints using ${skillText}`, "Create assessment criteria", `Identify missing proof around ${gaps[0]}`], ["Learning plan connects objective, activity, and assessment"]],
      ["Build instructional materials", ["Create lesson/module outline", "Add practice, feedback, and differentiation", "Prepare supporting slides or worksheet"], ["Material supports at least 3 learner needs"]],
      ["Measure learning effectiveness", ["Collect quiz, rubric, or feedback data", `Adjust instruction based on ${gaps[1]}`, "Document improvement actions"], ["Learner outcome or engagement metric improves"]],
      ["Prepare education portfolio proof", ["Create teaching/training case study", "Add assessment results or learner feedback", "Rewrite resume bullets around learning outcomes"], ["Case study shows instructional decision and result"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(operations|supply chain|logistics|procurement|warehouse|inventory)/.test(normalized)) {
    return [
      [`Map ${role} operating workflow`, [`Document process steps, handoffs, and bottlenecks using ${skillText}`, "Identify delay, cost, or quality risks", `Prioritize missing proof around ${gaps[0]}`], ["Workflow includes cycle time, owner, and failure point"]],
      ["Improve process control", ["Create SOP or checklist", "Define exception handling and escalation", "Track throughput or defect categories"], ["SOP reduces rework or missed handoffs"]],
      ["Build reporting and optimization proof", ["Create inventory, SLA, or vendor performance report", `Analyze impact of ${gaps[1]}`, "Recommend one process change"], ["Recommendation ties to cost, speed, or quality metric"]],
      ["Prepare operations interview proof", ["Create process-improvement story", "Practice tradeoff between speed, cost, and quality", "Rewrite resume bullets around operational impact"], ["Story shows measurable process improvement"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  if (/(cyber|security|soc|information security|iam|governance|grc)/.test(normalized)) {
    return [
      [`Baseline ${role} security scope`, [`Map assets, identities, threats, and controls using ${skillText}`, "Identify highest-risk gaps", `Prioritize missing proof around ${gaps[0]}`], ["Risk register includes impact, likelihood, owner, and mitigation"]],
      ["Build detection or control evidence", ["Create sample alert, policy, or access review", "Document false positive and escalation handling", "Map control to business risk"], ["Control has clear trigger, response, and audit trail"]],
      ["Practice incident and compliance response", ["Write incident timeline", `Add mitigation plan for ${gaps[1]}`, "Prepare post-incident prevention notes"], ["Response plan covers detect, contain, recover, and prevent"]],
      ["Prepare security interview proof", ["Create security case study", "Practice threat modeling or GRC scenario", "Rewrite resume bullets around risk reduction"], ["Story includes risk, action, control, and measurable result"]]
    ] satisfies Array<[string, string[], string[]]>;
  }

  const capability = extractRoleCapability(role);
  return [
    [`Map ${role} outcomes`, [`Extract repeated outcomes from 3 ${role} job descriptions`, `Compare ${skillText} against ${capability} expectations`, `Prioritize missing proof around ${gaps[0]}`], [`Outcome map names ${role} responsibilities, proof gaps, and success measures`]],
    [`Build ${capability} proof`, [`Create a ${capability} case study for a realistic ${role} scenario`, `Use ${primarySkill} as the starting advantage`, "Document context, decision, stakeholder, and result"], [`Case study proves ${capability} with measurable evidence`]],
    [`Practice ${gaps[1]} in context`, [`Complete one scenario where ${role} decisions affect quality, cost, speed, or customer impact`, `Record assumptions and tradeoffs around ${gaps[1]}`, "Write what failure would look like and how to recover"], ["Scenario answer includes constraint, action, tradeoff, and success metric"]],
    [`Package ${role} evidence`, [`Review the case study against target ${role} job descriptions`, "Remove weak or unrelated claims", `Rewrite resume bullet around ${primarySkill}, ${gaps[0]}, and measurable outcome`], ["Final proof reads specific to the selected role and skills"]]
  ] satisfies Array<[string, string[], string[]]>;
}

function inferSkillGaps(targetRole: string, currentSkills: string[]) {
  const normalizedRole = targetRole.toLowerCase();
  const owned = new Set(currentSkills.map((skill) => skill.toLowerCase()));
  const roleRequirements = getRoleRequirements(normalizedRole);
  const missing = roleRequirements.filter((skill) => ![...owned].some((current) => current.includes(skill.toLowerCase()) || skill.toLowerCase().includes(current)));
  return [...missing, ...roleRequirements].slice(0, 6);
}

function getRoleRequirements(role: string) {
  if (/(frontend|front-end|react|ui|web)/.test(role)) return ["accessibility", "state management", "performance", "testing", "responsive design", "API integration"];
  if (/(backend|back-end|api|server|node|java|spring|nestjs)/.test(role)) return ["API design", "database modeling", "authentication", "caching", "observability", "reliability"];
  if (/(data|analytics|analyst|bi)/.test(role)) return ["SQL", "data visualization", "statistical thinking", "business metrics", "dashboard storytelling", "data quality"];
  if (/(qa|test|quality|automation)/.test(role)) return ["test automation", "regression strategy", "flaky test analysis", "release risk", "coverage planning", "bug triage"];
  if (/(devops|sre|cloud|platform|infrastructure)/.test(role)) return ["CI/CD", "monitoring", "incident response", "infrastructure as code", "containers", "deployment rollback"];
  if (/(product manager|program manager|project manager|pm\b|scrum)/.test(role)) return ["prioritization", "user research", "metrics", "roadmapping", "stakeholder alignment", "launch planning"];
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

function buildRoadmapReport(targetRole: string, currentSkills: string[], milestones: Milestone[]) {
  return [
    "DevElevate AI Career Roadmap",
    `Target role: ${targetRole || "Not specified"}`,
    `Current skills: ${currentSkills.length ? currentSkills.join(", ") : "Not specified"}`,
    "",
    ...milestones.map((milestone, index) =>
      [
        `Week ${milestone.week ?? index + 1}: ${milestone.focus ?? "Career milestone"}`,
        ...(milestone.deliverables?.length ? ["Deliverables:", ...milestone.deliverables.map((item) => `- ${item}`)] : []),
        ...(milestone.metrics?.length ? [`Metric: ${milestone.metrics[0]}`] : [])
      ].join("\n")
    )
  ].join("\n\n");
}
