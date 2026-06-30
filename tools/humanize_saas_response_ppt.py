from __future__ import annotations

import html
import re
import zipfile
from pathlib import Path


SRC = Path(r"C:\Users\srava\Downloads\Class Activity 2 Team SaaS Response.pptx")
OUT = Path.cwd() / "Class_Activity_2_Team_SaaS_Response_Humanized.pptx"

W = 12_192_000
H = 6_858_000

NAVY = "14213D"
INK = "243044"
MUTED = "627084"
BG = "F7F9FC"
WHITE = "FFFFFF"
LINE = "DCE4EC"
TEAL = "00A6A6"
BLUE = "2474D6"
GREEN = "2E7D63"
AMBER = "F59E0B"
CORAL = "E85D5D"
LAV = "6D5BD0"


def esc(text: str) -> str:
    return html.escape(text, quote=False)


def solid(color: str) -> str:
    return f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'


def ln(color: str = LINE, width: int = 9525) -> str:
    return f'<a:ln w="{width}">{solid(color)}</a:ln>'


def xfrm(x: int, y: int, cx: int, cy: int) -> str:
    return f'<a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'


def body_pr() -> str:
    return '<a:bodyPr lIns="91440" tIns="68580" rIns="91440" bIns="68580" wrap="square"/><a:lstStyle/>'


def run(text: str, size: int, color: str = INK, bold: bool = False) -> str:
    b = ' b="1"' if bold else ""
    return (
        f'<a:r><a:rPr lang="en-US" sz="{size}"{b}>{solid(color)}'
        '<a:latin typeface="Aptos"/></a:rPr>'
        f'<a:t>{esc(text)}</a:t></a:r>'
    )


def para(text: str, size: int, color: str = INK, bold: bool = False, align: str = "l") -> str:
    return f'<a:p><a:pPr algn="{align}"/>{run(text, size, color, bold)}</a:p>'


def bullet(text: str, size: int = 1500, color: str = INK) -> str:
    return (
        '<a:p><a:pPr marL="220000" indent="-145000">'
        '<a:buChar char="•"/>'
        f'<a:defRPr sz="{size}">{solid(color)}<a:latin typeface="Aptos"/></a:defRPr>'
        f'</a:pPr>{run(text, size, color)}</a:p>'
    )


class Slide:
    def __init__(self) -> None:
        self.parts: list[str] = []
        self.sid = 2

    def next_id(self) -> int:
        value = self.sid
        self.sid += 1
        return value

    def rect(
        self,
        x: int,
        y: int,
        cx: int,
        cy: int,
        fill: str,
        *,
        outline: str | None = None,
        radius: str = "roundRect",
        name: str = "Shape",
    ) -> None:
        sid = self.next_id()
        line_xml = "" if outline is None else ln(outline)
        self.parts.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{sid}" name="{name} {sid}"/>'
            '<p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>'
            f'{xfrm(x, y, cx, cy)}<a:prstGeom prst="{radius}"><a:avLst/></a:prstGeom>'
            f'{solid(fill)}{line_xml}</p:spPr></p:sp>'
        )

    def text(
        self,
        x: int,
        y: int,
        cx: int,
        cy: int,
        paragraphs: list[str],
        *,
        fill: str | None = None,
        outline: str | None = None,
        radius: str = "rect",
        name: str = "Text",
    ) -> None:
        sid = self.next_id()
        fill_xml = '<a:noFill/>' if fill is None else solid(fill)
        line_xml = '<a:ln><a:noFill/></a:ln>' if outline is None else ln(outline)
        self.parts.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{sid}" name="{name} {sid}"/>'
            '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>'
            f'{xfrm(x, y, cx, cy)}<a:prstGeom prst="{radius}"><a:avLst/></a:prstGeom>'
            f'{fill_xml}{line_xml}</p:spPr><p:txBody>{body_pr()}'
            f'{"".join(paragraphs)}</p:txBody></p:sp>'
        )

    def xml(self) -> str:
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            '<p:cSld><p:bg><p:bgPr>' + solid(BG) + '</p:bgPr></p:bg><p:spTree>'
            '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>'
            + "".join(self.parts)
            + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
        )


def header(s: Slide, title: str, kicker: str, accent: str = TEAL) -> None:
    s.rect(0, 0, W, 310_000, NAVY, radius="rect")
    s.rect(0, 310_000, 1_600_000, 80_000, accent, radius="rect")
    s.rect(1_600_000, 310_000, 1_600_000, 80_000, BLUE, radius="rect")
    s.text(690_000, 555_000, 8_900_000, 560_000, [para(title, 3050, NAVY, True)])
    s.text(700_000, 1_150_000, 9_800_000, 380_000, [para(kicker, 1400, MUTED)])


def pill(s: Slide, x: int, y: int, label: str, color: str, cx: int = 1_150_000) -> None:
    s.text(x, y, cx, 330_000, [para(label, 1225, WHITE, True, "ctr")], fill=color, radius="roundRect")


def card(s: Slide, x: int, y: int, cx: int, cy: int, title: str, items: list[str], accent: str) -> None:
    s.rect(x, y, cx, cy, WHITE, outline=LINE)
    s.rect(x, y, 90_000, cy, accent, radius="rect")
    s.text(x + 180_000, y + 130_000, cx - 280_000, 330_000, [para(title, 1700, NAVY, True)])
    s.text(x + 180_000, y + 560_000, cx - 280_000, cy - 660_000, [bullet(item, 1375) for item in items])


def table_cell(s: Slide, x: int, y: int, cx: int, cy: int, text: str, *, fill: str, color: str = INK, bold: bool = False, size: int = 1180) -> None:
    s.text(x, y, cx, cy, [para(text, size, color, bold, "ctr")], fill=fill, outline=LINE)


def slide_1() -> str:
    s = Slide()
    s.rect(0, 0, W, H, NAVY, radius="rect")
    s.rect(780_000, 900_000, 10_630_000, 4_650_000, "F4F7FB", outline="4B5B73")
    s.rect(780_000, 900_000, 10_630_000, 390_000, TEAL, radius="rect")
    s.text(1_130_000, 1_720_000, 9_900_000, 950_000, [para("Class Activity 2", 4400, NAVY, True, "ctr")])
    s.text(1_130_000, 2_650_000, 9_900_000, 860_000, [para("Team SaaS Response", 3900, TEAL, True, "ctr")])
    s.text(1_730_000, 3_760_000, 8_700_000, 650_000, [para("A practical SaaS comparison across AWS, Azure, healthcare use cases, tradeoffs, and an executive pitch.", 1650, MUTED, False, "ctr")])
    s.text(2_400_000, 5_040_000, 7_400_000, 420_000, [para("Sahithi | Ebenezer Fynn | Al Rafy", 1500, WHITE, True, "ctr")], fill=NAVY, radius="roundRect")
    return s.xml()


def slide_2() -> str:
    s = Slide()
    header(s, "Phase 1: SaaS service mapping", "A quick look at where AWS and Azure show up in common SaaS categories.", TEAL)
    x0, y0 = 520_000, 1_850_000
    widths = [2_000_000, 2_520_000, 2_780_000, 3_650_000]
    headers = ["SaaS area", "AWS option", "Azure option", "What changes"]
    colors = [NAVY, NAVY, NAVY, NAVY]
    x = x0
    for width, title, color in zip(widths, headers, colors):
        table_cell(s, x, y0, width, 490_000, title, fill=color, color=WHITE, bold=True, size=1175)
        x += width
    rows = [
        ("Business apps", "AWS Marketplace SaaS apps", "Microsoft 365 and Dynamics 365", "Azure connects more naturally to business productivity workflows."),
        ("Contact center", "Amazon Connect", "Dynamics 365 Customer Service", "Amazon Connect is more cloud-native for call center automation."),
        ("Collaboration", "Amazon Chime", "Microsoft Teams / Microsoft 365", "Microsoft has stronger Office and enterprise adoption."),
        ("DevOps SaaS", "Marketplace DevOps tools", "Azure DevOps", "Azure DevOps creates tighter Microsoft ecosystem dependence."),
    ]
    y = y0 + 490_000
    for idx, row in enumerate(rows):
        x = x0
        fill = WHITE if idx % 2 == 0 else "EEF4F8"
        for width, value in zip(widths, row):
            table_cell(s, x, y, width, 720_000, value, fill=fill, size=1075)
            x += width
        y += 720_000
    pill(s, 930_000, 5_570_000, "Bottom line", TEAL, 1_270_000)
    s.text(2_290_000, 5_530_000, 8_850_000, 430_000, [para("Azure is stronger when Microsoft tools are already standard. AWS gives more marketplace flexibility.", 1350, MUTED)])
    return s.xml()


def slide_3() -> str:
    s = Slide()
    header(s, "Ecosystem lock-in focus", "Lock-in is not always bad, but teams should know what they are committing to.", LAV)
    card(s, 730_000, 1_980_000, 4_960_000, 2_760_000, "AWS pattern", ["Works best when the company already uses AWS IAM, CloudWatch, and AWS Marketplace.", "Offers more flexibility through many third-party SaaS choices.", "Less tied to one office productivity stack."], AMBER)
    card(s, 6_480_000, 1_980_000, 4_960_000, 2_760_000, "Azure pattern", ["Creates deeper lock-in through Microsoft 365, Teams, Entra ID, Dynamics 365, and Azure DevOps.", "Strong fit for Office, Outlook, Teams, and Windows environments.", "Tighter integration can reduce friction for enterprise teams."], BLUE)
    s.text(1_110_000, 5_330_000, 10_000_000, 620_000, [para("Human takeaway: AWS gives choice. Azure gives integration. The right answer depends on whether the business values flexibility or a tightly connected Microsoft stack.", 1600, WHITE, True, "ctr")], fill=NAVY, radius="roundRect")
    return s.xml()


def slide_4() -> str:
    s = Slide()
    header(s, "Scenario B: Healthcare SaaS mapping", "For a legacy patient database migration, SaaS can speed up delivery while reducing infrastructure work.", GREEN)
    x0, y0 = 540_000, 1_790_000
    widths = [2_520_000, 2_780_000, 2_880_000, 2_920_000]
    headers = ["Healthcare need", "AWS SaaS service", "Azure SaaS service", "Use case"]
    x = x0
    for width, title in zip(widths, headers):
        table_cell(s, x, y0, width, 470_000, title, fill=NAVY, color=WHITE, bold=True, size=1125)
        x += width
    rows = [
        ("Health records", "AWS HealthLake", "Microsoft Cloud for Healthcare", "Store and manage patient health records."),
        ("Communication", "Amazon Chime", "Microsoft Teams", "Support telemedicine and staff coordination."),
        ("Patient engagement", "Salesforce Health Cloud on AWS", "Dynamics 365 Healthcare", "Manage appointments and patient communication."),
        ("Analytics", "Amazon QuickSight", "Power BI", "Build reporting, dashboards, and care insights."),
    ]
    y = y0 + 470_000
    for idx, row in enumerate(rows):
        x = x0
        fill = WHITE if idx % 2 == 0 else "EEF6F0"
        for width, value in zip(widths, row):
            table_cell(s, x, y, width, 760_000, value, fill=fill, size=1030)
            x += width
        y += 760_000
    s.text(1_040_000, 5_650_000, 10_100_000, 440_000, [para("Recommendation: prioritize HIPAA-ready configuration, identity controls, audit logging, and data migration planning before choosing a SaaS vendor.", 1425, NAVY, True, "ctr")], fill=WHITE, outline=LINE, radius="roundRect")
    return s.xml()


def slide_5() -> str:
    s = Slide()
    header(s, "Healthcare SaaS tradeoff analysis", "SaaS reduces operational work, but healthcare teams still need control, privacy, and resilience.", CORAL)
    card(s, 800_000, 1_930_000, 3_250_000, 2_800_000, "Key benefits", ["Fast deployment of healthcare applications.", "Lower infrastructure cost.", "Automatic updates and security patches.", "Easier access to patient data across locations."], GREEN)
    card(s, 4_470_000, 1_930_000, 3_250_000, 2_800_000, "Pros", ["Quick implementation.", "Less workload for internal IT.", "Scales as patient data grows.", "Subscription model keeps adoption flexible."], BLUE)
    card(s, 8_140_000, 1_930_000, 3_250_000, 2_800_000, "Cons", ["Limited customization.", "Less control over platform internals.", "Internet dependency.", "Vendor lock-in and privacy risk."], CORAL)
    s.text(1_090_000, 5_360_000, 10_000_000, 580_000, [para("Decision lens: SaaS is attractive when speed and lower maintenance matter, but healthcare data makes governance and vendor review non-negotiable.", 1550, WHITE, True, "ctr")], fill=NAVY, radius="roundRect")
    return s.xml()


def slide_6() -> str:
    s = Slide()
    header(s, "Phase 3: Board pitch", "Executive summary for why this SaaS approach makes business sense.", TEAL)
    s.rect(760_000, 1_880_000, 10_670_000, 3_350_000, WHITE, outline=LINE)
    s.text(1_150_000, 2_230_000, 4_900_000, 1_420_000, [para("What we are proposing", 2100, TEAL, True), para("A cloud-based software platform that users can access through the internet without local installation, server maintenance, or manual upgrades.", 1550, INK)])
    s.text(6_360_000, 2_230_000, 4_630_000, 1_420_000, [para("Why it matters", 2100, BLUE, True), para("The organization gets secure, scalable, on-demand access while reducing IT cost and improving availability for users.", 1550, INK)])
    s.text(1_150_000, 4_030_000, 9_830_000, 550_000, [para("The subscription model lets the business scale usage up or down based on demand while the provider manages updates and platform reliability.", 1500, MUTED, False, "ctr")], fill="EEF4F8", outline=LINE, radius="roundRect")
    s.text(1_030_000, 5_680_000, 10_120_000, 440_000, [para("Board ask: approve SaaS evaluation using cost, security, compliance, integration, and vendor lock-in as decision criteria.", 1500, WHITE, True, "ctr")], fill=NAVY, radius="roundRect")
    return s.xml()


def slide_7() -> str:
    s = Slide()
    header(s, "Peer review improvements", "Feedback helped make the presentation clearer, more practical, and easier to follow.", LAV)
    card(s, 840_000, 1_980_000, 3_250_000, 2_750_000, "Feedback received", ["Simplify technical language.", "Improve slide structure.", "Add real-world SaaS examples.", "Explain security and privacy more clearly."], LAV)
    card(s, 4_470_000, 1_980_000, 3_250_000, 2_750_000, "Examples added", ["Microsoft 365.", "Google Workspace.", "Teams and Outlook.", "Healthcare reporting and patient engagement tools."], BLUE)
    card(s, 8_100_000, 1_980_000, 3_250_000, 2_750_000, "Final result", ["Clearer flow.", "More practical examples.", "Stronger focus on data privacy.", "Better balance of benefits and risks."], GREEN)
    s.text(1_170_000, 5_410_000, 9_840_000, 520_000, [para("Overall peer review was positive: the core idea was easy to follow, and the main improvements were about making the message more real-world and decision-ready.", 1500, NAVY, True, "ctr")], fill=WHITE, outline=LINE, radius="roundRect")
    return s.xml()


def slide_8() -> str:
    s = Slide()
    header(s, "References", "Sources used to frame cloud computing and SaaS concepts.", NAVY)
    s.rect(920_000, 1_900_000, 10_350_000, 3_650_000, WHITE, outline=LINE)
    s.text(
        1_250_000,
        2_250_000,
        9_750_000,
        2_650_000,
        [
            para("Mell, P., & Grance, T. (2011). The NIST definition of cloud computing. National Institute of Standards and Technology.", 1450, INK),
            para("https://doi.org/10.6028/NIST.SP.800-145", 1300, BLUE),
            para("Simmon, E. (2018). Evaluation of cloud computing services based on NIST SP 800-145. National Institute of Standards and Technology.", 1450, INK),
            para("https://doi.org/10.6028/NIST.SP.500-322", 1300, BLUE),
        ],
    )
    s.text(1_230_000, 5_780_000, 9_850_000, 360_000, [para("End of presentation", 1450, WHITE, True, "ctr")], fill=NAVY, radius="roundRect")
    return s.xml()


def patch_presentation(xml: str) -> str:
    return re.sub(
        r'<p:sldSz\b[^>]*/>',
        f'<p:sldSz cx="{W}" cy="{H}" type="screen16x9"/>',
        xml,
        count=1,
    )


def main() -> None:
    if not SRC.exists():
        raise FileNotFoundError(SRC)
    slides = [slide_1(), slide_2(), slide_3(), slide_4(), slide_5(), slide_6(), slide_7(), slide_8()]
    replacements = {f"ppt/slides/slide{i}.xml": slide.encode("utf-8") for i, slide in enumerate(slides, 1)}
    with zipfile.ZipFile(SRC, "r") as zin, zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == "ppt/presentation.xml":
                data = patch_presentation(data.decode("utf-8")).encode("utf-8")
            if info.filename in replacements:
                data = replacements[info.filename]
            zout.writestr(info, data)
    print(OUT)


if __name__ == "__main__":
    main()
