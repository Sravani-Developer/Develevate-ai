from __future__ import annotations

import html
import os
import zipfile
from pathlib import Path


SRC = Path(r"C:\Users\srava\Downloads\AWS_vs_Azure_Comparison_Presentation.pptx")
OUT = Path.cwd() / "AWS_vs_Azure_Humanized_Visual.pptx"

W = 12_192_000
H = 6_858_000

AWS = "FF9900"
AZURE = "0078D4"
NAVY = "172033"
INK = "243044"
MUTED = "5F6B7A"
BG = "F6F8FB"
WHITE = "FFFFFF"
LINE = "D9E1EA"
GREEN = "2E7D63"


def esc(text: str) -> str:
    return html.escape(text, quote=False)


def solid(color: str) -> str:
    return f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'


def line(color: str = LINE, width: int = 9525) -> str:
    return f'<a:ln w="{width}">{solid(color)}</a:ln>'


def xfrm(x: int, y: int, cx: int, cy: int) -> str:
    return f'<a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'


def body_margin() -> str:
    return '<a:bodyPr lIns="91440" tIns="73152" rIns="91440" bIns="73152" wrap="square"/><a:lstStyle/>'


def text_runs(text: str, size: int, color: str = INK, bold: bool = False, font: str = "Aptos") -> str:
    b = ' b="1"' if bold else ""
    return (
        f'<a:r><a:rPr lang="en-US" sz="{size}"{b}>{solid(color)}'
        f'<a:latin typeface="{font}"/></a:rPr><a:t>{esc(text)}</a:t></a:r>'
    )


def paragraph(text: str, size: int, color: str = INK, bold: bool = False, align: str = "l") -> str:
    return f'<a:p><a:pPr algn="{align}"/>{text_runs(text, size, color, bold)}</a:p>'


def bullet(text: str, size: int = 1900, color: str = INK) -> str:
    return (
        '<a:p><a:pPr marL="228600" indent="-152400">'
        '<a:buChar char="•"/>'
        f'<a:defRPr sz="{size}">{solid(color)}<a:latin typeface="Aptos"/></a:defRPr>'
        f'</a:pPr>{text_runs(text, size, color)}</a:p>'
    )


class Slide:
    def __init__(self) -> None:
        self.parts: list[str] = []
        self.shape_id = 2

    def next_id(self) -> int:
        sid = self.shape_id
        self.shape_id += 1
        return sid

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
        ln = "" if outline is None else line(outline)
        self.parts.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{sid}" name="{name} {sid}"/>'
            '<p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>'
            f'{xfrm(x, y, cx, cy)}<a:prstGeom prst="{radius}"><a:avLst/></a:prstGeom>'
            f'{solid(fill)}{ln}</p:spPr></p:sp>'
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
        ln_xml = '<a:ln><a:noFill/></a:ln>' if outline is None else line(outline)
        self.parts.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{sid}" name="{name} {sid}"/>'
            '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>'
            f'{xfrm(x, y, cx, cy)}<a:prstGeom prst="{radius}"><a:avLst/></a:prstGeom>'
            f'{fill_xml}{ln_xml}</p:spPr><p:txBody>{body_margin()}'
            f'{"".join(paragraphs)}</p:txBody></p:sp>'
        )

    def line(self, x1: int, y1: int, x2: int, y2: int, color: str = LINE, width: int = 19050) -> None:
        sid = self.next_id()
        self.parts.append(
            f'<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="{sid}" name="Line {sid}"/>'
            '<p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>'
            f'<a:xfrm><a:off x="{x1}" y="{y1}"/><a:ext cx="{x2 - x1}" cy="{y2 - y1}"/></a:xfrm>'
            '<a:prstGeom prst="line"><a:avLst/></a:prstGeom>'
            f'{line(color, width)}</p:spPr></p:cxnSp>'
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


def add_header(s: Slide, title: str, eyebrow: str) -> None:
    s.rect(0, 0, W, 285_750, NAVY, radius="rect")
    s.rect(0, 285_750, 2_200_000, 68_580, AWS, radius="rect")
    s.rect(2_200_000, 285_750, 2_200_000, 68_580, AZURE, radius="rect")
    s.text(685_800, 548_640, 8_300_000, 900_000, [paragraph(title, 3300, NAVY, True)])
    s.text(705_800, 1_325_000, 8_850_000, 460_000, [paragraph(eyebrow, 1450, MUTED)])


def pill(s: Slide, x: int, y: int, label: str, color: str) -> None:
    s.text(x, y, 910_000, 335_000, [paragraph(label, 1250, WHITE, True, "ctr")], fill=color, radius="roundRect")


def card(s: Slide, x: int, y: int, cx: int, cy: int, title: str, body: list[str], accent: str) -> None:
    s.rect(x, y, cx, cy, WHITE, outline=LINE)
    s.rect(x, y, 95_250, cy, accent, radius="rect")
    s.text(x + 180_000, y + 120_000, cx - 300_000, 330_000, [paragraph(title, 1700, NAVY, True)])
    s.text(x + 180_000, y + 520_000, cx - 300_000, cy - 600_000, [bullet(item, 1425, INK) for item in body])


def slide_1() -> str:
    s = Slide()
    s.rect(0, 0, W, H, NAVY, radius="rect")
    s.rect(780_000, 770_000, 4_850_000, 4_650_000, "FFF3DE", outline="F3C277")
    s.rect(6_560_000, 770_000, 4_850_000, 4_650_000, "E9F3FF", outline="93BFE8")
    s.text(1_100_000, 1_150_000, 4_250_000, 900_000, [paragraph("AWS", 5600, AWS, True, "ctr")])
    s.text(6_900_000, 1_150_000, 4_250_000, 900_000, [paragraph("Azure", 5600, AZURE, True, "ctr")])
    s.text(
        1_150_000,
        2_180_000,
        4_150_000,
        1_500_000,
        [paragraph("Broadest cloud toolbox, strong for cloud-native teams and global scale.", 2100, INK, False, "ctr")],
    )
    s.text(
        6_950_000,
        2_180_000,
        4_150_000,
        1_500_000,
        [paragraph("Deep Microsoft integration, strong for enterprise IT and hybrid environments.", 2100, INK, False, "ctr")],
    )
    s.text(
        1_320_000,
        5_600_000,
        9_550_000,
        760_000,
        [paragraph("A practical comparison of services, security, and where each platform fits best", 2600, WHITE, True, "ctr")],
    )
    s.text(5_720_000, 3_650_000, 760_000, 620_000, [paragraph("vs", 2600, NAVY, True, "ctr")], fill=WHITE, outline=LINE, radius="ellipse")
    return s.xml()


def slide_2() -> str:
    s = Slide()
    add_header(s, "Core cloud building blocks", "The service names differ, but the job they do is familiar.")
    xs = [610_000, 3_320_000, 6_030_000, 8_740_000]
    data = [
        ("Compute", ["AWS EC2", "Azure Virtual Machines", "Run scalable virtual servers."], AWS),
        ("Storage", ["Amazon S3", "Azure Blob Storage", "Store objects, backups, media, and logs."], AZURE),
        ("Databases", ["Amazon RDS", "Azure SQL Database", "Managed relational data with less admin work."], GREEN),
        ("Networking", ["AWS VPC", "Azure Virtual Network", "Private networks, routing, and connectivity."], NAVY),
    ]
    for x, (title, body, accent) in zip(xs, data):
        card(s, x, 2_160_000, 2_360_000, 2_820_000, title, body, accent)
    s.text(
        1_060_000,
        5_550_000,
        10_050_000,
        600_000,
        [paragraph("Plain English: both platforms cover the same foundations. The better choice usually comes down to your existing tools, skills, and operating model.", 1700, MUTED, False, "ctr")],
    )
    return s.xml()


def slide_3() -> str:
    s = Slide()
    add_header(s, "Building apps faster", "Beyond virtual machines, both clouds help teams ship software with less infrastructure work.")
    card(s, 720_000, 2_030_000, 3_200_000, 2_450_000, "Managed apps", ["Elastic Beanstalk", "Azure App Service", "Good fit for web apps and APIs."], AWS)
    card(s, 4_500_000, 2_030_000, 3_200_000, 2_450_000, "Serverless", ["AWS Lambda", "Azure Functions", "Run code only when events happen."], AZURE)
    card(s, 8_280_000, 2_030_000, 3_200_000, 2_450_000, "AI and ML", ["Amazon SageMaker", "Azure Machine Learning", "Build, train, and deploy models."], GREEN)
    s.rect(1_050_000, 5_250_000, 10_100_000, 650_000, "EEF4F8", outline=LINE)
    s.text(1_250_000, 5_360_000, 9_700_000, 430_000, [paragraph("Key takeaway: AWS often feels like a large specialist toolkit; Azure feels strongest when the organization already runs on Microsoft.", 1650, NAVY, True, "ctr")])
    return s.xml()


def slide_4() -> str:
    s = Slide()
    add_header(s, "Security is shared", "The cloud provider protects the platform. Your team still owns how it is used.")
    s.rect(760_000, 2_020_000, 4_960_000, 2_980_000, "FFF4E4", outline="F3C277")
    s.rect(6_460_000, 2_020_000, 4_960_000, 2_980_000, "EAF4FF", outline="93BFE8")
    s.text(1_020_000, 2_240_000, 4_420_000, 430_000, [paragraph("Provider secures", 2100, AWS, True, "ctr")])
    s.text(6_720_000, 2_240_000, 4_420_000, 430_000, [paragraph("Customer secures", 2100, AZURE, True, "ctr")])
    s.text(1_070_000, 2_940_000, 4_300_000, 1_400_000, [bullet("Physical data centers and hardware", 1550), bullet("Core cloud infrastructure", 1550), bullet("Managed service reliability", 1550)])
    s.text(6_770_000, 2_940_000, 4_300_000, 1_400_000, [bullet("Identity and access rules", 1550), bullet("Data, apps, and configurations", 1550), bullet("Monitoring, encryption, and compliance setup", 1550)])
    s.text(1_240_000, 5_410_000, 9_700_000, 530_000, [paragraph("Identity comparison: AWS IAM handles permissions in AWS; Microsoft Entra ID is central for Azure and Microsoft 365 environments.", 1600, NAVY, True, "ctr")], fill=WHITE, outline=LINE, radius="roundRect")
    return s.xml()


def slide_5() -> str:
    s = Slide()
    add_header(s, "Where each platform shines", "Both are mature. Their strengths show up in different organizational contexts.")
    card(s, 770_000, 2_000_000, 5_050_000, 3_250_000, "AWS strengths", ["Very large service catalog", "Broad global footprint", "Strong cloud-native ecosystem", "Common choice for startups and digital products"], AWS)
    card(s, 6_370_000, 2_000_000, 5_050_000, 3_250_000, "Azure strengths", ["Works naturally with Windows Server, Microsoft 365, and Entra ID", "Strong enterprise and hybrid-cloud story", "Familiar path for many IT teams", "Often easier when Microsoft licensing is already in place"], AZURE)
    pill(s, 2_090_000, 5_640_000, "AWS fit", AWS)
    s.text(3_120_000, 5_620_000, 2_600_000, 380_000, [paragraph("cloud-native builds and broad service choice", 1300, MUTED)])
    pill(s, 6_760_000, 5_640_000, "Azure fit", AZURE)
    s.text(7_790_000, 5_620_000, 3_200_000, 380_000, [paragraph("Microsoft-heavy enterprises and hybrid IT", 1300, MUTED)])
    return s.xml()


def slide_6() -> str:
    s = Slide()
    add_header(s, "Bottom line", "There is no universal winner. There is a better fit for a specific team and business.")
    s.rect(820_000, 1_980_000, 10_560_000, 3_300_000, WHITE, outline=LINE)
    s.text(1_210_000, 2_240_000, 4_550_000, 440_000, [paragraph("Choose AWS when...", 1950, AWS, True)])
    s.text(1_270_000, 2_850_000, 4_550_000, 1_440_000, [bullet("You need maximum service breadth.", 1550), bullet("Your teams already know AWS patterns.", 1550), bullet("You are building mostly cloud-native apps.", 1550)])
    s.line(6_095_000, 2_220_000, 6_095_000, 4_900_000, LINE, 12700)
    s.text(6_480_000, 2_240_000, 4_550_000, 440_000, [paragraph("Choose Azure when...", 1950, AZURE, True)])
    s.text(6_540_000, 2_850_000, 4_550_000, 1_440_000, [bullet("Microsoft is already core to the business.", 1550), bullet("Hybrid cloud is important.", 1550), bullet("Identity and enterprise integration matter most.", 1550)])
    s.text(1_080_000, 5_690_000, 10_020_000, 560_000, [paragraph("Recommendation: evaluate the platform against requirements, cost, compliance needs, team skills, and the systems you already run.", 1700, WHITE, True, "ctr")], fill=NAVY, radius="roundRect")
    return s.xml()


def patched_presentation(xml: str) -> str:
    xml = xml.replace('cx="9144000" cy="6858000" type="screen4x3"', f'cx="{W}" cy="{H}" type="screen16x9"')
    return xml


def main() -> None:
    if not SRC.exists():
        raise FileNotFoundError(SRC)
    slides = [slide_1(), slide_2(), slide_3(), slide_4(), slide_5(), slide_6()]
    replacements = {f"ppt/slides/slide{i}.xml": xml.encode("utf-8") for i, xml in enumerate(slides, 1)}

    with zipfile.ZipFile(SRC, "r") as zin, zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == "ppt/presentation.xml":
                data = patched_presentation(data.decode("utf-8")).encode("utf-8")
            if info.filename in replacements:
                data = replacements[info.filename]
            zout.writestr(info, data)

    print(OUT)


if __name__ == "__main__":
    main()
