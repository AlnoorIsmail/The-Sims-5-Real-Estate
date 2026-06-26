# Build The Sims 5 Real Estate presentation using Microsoft PowerPoint COM
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$OutDir = Join-Path $Root "outputs\presentation"
$Assets = Join-Path $OutDir "assets"
$CursorAssets = "C:\Users\kufas\.cursor\projects\c-Users-kufas-OneDrive-Documents-GitHub-The-Sims-5-Real-Estate\assets"

New-Item -ItemType Directory -Force -Path $Assets | Out-Null

$images = @(
    "ppt-hero-abu-dhabi.png",
    "ppt-tenant-simulator.png",
    "ppt-investment-dashboard.png"
)

foreach ($img in $images) {
    $src = Join-Path $CursorAssets $img
    $dst = Join-Path $Assets $img
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
    } elseif (-not (Test-Path $dst)) {
        throw "Missing image: $src"
    }
}

$Hero = Join-Path $Assets "ppt-hero-abu-dhabi.png"
$Sim  = Join-Path $Assets "ppt-tenant-simulator.png"
$Dash = Join-Path $Assets "ppt-investment-dashboard.png"
$OutFile = Join-Path $OutDir "The-Sims-5-Real-Estate-Presentation.pptx"

# Slide dimensions (16:9)
$SlideW = 960
$SlideH = 540

function Set-DarkBackground($slide, $r, $g, $b) {
    $slide.FollowMasterBackground = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $slide.Background.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
    $slide.Background.Fill.ForeColor.RGB = ($b -shl 16) -bor ($g -shl 8) -bor $r
    $slide.Background.Fill.Solid()
}

function Add-TitleText($slide, $text, $left, $top, $width, $height, $size, $bold, $r, $g, $b) {
    $shape = $slide.Shapes.AddTextbox(1, $left, $top, $width, $height)
    $shape.TextFrame.TextRange.Text = $text
    $shape.TextFrame.TextRange.Font.Size = $size
    $shape.TextFrame.TextRange.Font.Bold = $bold
    $shape.TextFrame.TextRange.Font.Color.RGB = ($b -shl 16) -bor ($g -shl 8) -bor $r
    $shape.TextFrame.TextRange.ParagraphFormat.Alignment = 1
    $shape.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $shape.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    return $shape
}

function Add-BodyText($slide, $lines, $left, $top, $width, $height, $size) {
    $shape = $slide.Shapes.AddTextbox(1, $left, $top, $width, $height)
    $shape.Fill.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $shape.Line.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    $tr = $shape.TextFrame.TextRange
    $tr.Text = $lines[0]
    $tr.Font.Size = $size
    $tr.Font.Color.RGB = (0xE0 -shl 16) -bor (0xE8 -shl 8) -bor 0xF5
    for ($i = 1; $i -lt $lines.Count; $i++) {
        $p = $tr.InsertAfter("`r`n" + $lines[$i])
        $p.Font.Size = $size
        $p.Font.Color.RGB = (0xE0 -shl 16) -bor (0xE8 -shl 8) -bor 0xF5
    }
    $shape.TextFrame.TextRange.ParagraphFormat.Bullet.Type = 2
    return $shape
}

function Add-Picture($slide, $path, $left, $top, $width) {
    if (Test-Path $path) {
        return $slide.Shapes.AddPicture($path, $false, $true, $left, $top, $width, $width * 0.75)
    }
}

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = -1
$pres = $ppt.Presentations.Add()

# --- Slide 1: Title ---
$s1 = $pres.Slides.Add(1, 12)
Set-DarkBackground $s1 15 23 42
Add-Picture $s1 $Hero 0 0 $SlideW | Out-Null
$overlay = $s1.Shapes.AddShape(1, 0, 0, $SlideW, $SlideH)
$overlay.Fill.ForeColor.RGB = (42 -shl 16) -bor (23 -shl 8) -bor 15
$overlay.Fill.Transparency = 0.35
$overlay.Line.Visible = 0
Add-TitleText $s1 "The Sims 5 Real Estate" 40 160 880 80 44 $true 245 240 232
Add-TitleText $s1 "AI intelligence for land, investment, and community decisions in Abu Dhabi" 40 250 880 60 22 $false 201 184 150
Add-TitleText $s1 "Abu Dhabi AI PropTech Challenge - Investment + Decision Intelligence" 40 470 880 40 14 $false 148 163 184

# --- Slide 2: Problem ---
$s2 = $pres.Slides.Add(2, 12)
Set-DarkBackground $s2 15 23 42
Add-TitleText $s2 "The Problem" 40 30 880 50 32 $true 245 240 232
Add-BodyText $s2 @(
    "Investors chase attractive assets - especially beach-facing buildings - but miss hidden risks",
    "Low rental yield, coastal maintenance, and weak infrastructure can erase profit margins",
    "Landlords have no way to test how tenant life and management choices affect ROI over time",
    "Decisions are often made on gut feel instead of connected data and simulation"
) 40 100 880 380 20

# --- Slide 3: Section ---
$s3 = $pres.Slides.Add(3, 12)
Set-DarkBackground $s3 30 41 59
$accent = $s3.Shapes.AddShape(1, 0, 0, 8, $SlideH)
$accent.Fill.ForeColor.RGB = (150 -shl 16) -bor (184 -shl 8) -bor 201
$accent.Line.Visible = 0
Add-TitleText $s3 "Our Solution" 50 200 860 60 36 $true 245 240 232
Add-TitleText $s3 "Two connected layers: score the asset, then simulate how you run it" 50 270 860 50 20 $false 148 163 184

# --- Slide 4: Two columns ---
$s4 = $pres.Slides.Add(4, 12)
Set-DarkBackground $s4 15 23 42
Add-TitleText $s4 "One Product, Two Brains" 40 30 880 50 32 $true 245 240 232
Add-TitleText $s4 "Investment Intelligence" 40 90 420 40 22 $true 201 184 150
Add-BodyText $s4 @(
    "Scores Abu Dhabi parcels and districts",
    "Predicts value, yield, and development potential",
    "Returns BUY / CONSIDER / DO NOT BUY",
    "Flags coastal and margin risks with warnings",
    "Live demo on the web dashboard today"
) 40 130 420 360 17
Add-TitleText $s4 "Tenant Simulator" 500 90 420 40 22 $true 201 184 150
Add-BodyText $s4 @(
    "Mini Sims-style building with AI residents",
    "Tenants talk, complain, pay rent, move in/out",
    "Landlord responds to repairs and complaints",
    "Updates reputation, occupancy, maintenance, ROI",
    "Partially built - visual panel coming next"
) 500 130 420 360 17

# --- Slide 5: Investment dashboard ---
$s5 = $pres.Slides.Add(5, 12)
Set-DarkBackground $s5 15 23 42
Add-TitleText $s5 "Investment Dashboard" 40 30 880 50 32 $true 245 240 232
Add-BodyText $s5 @(
    "Synthetic Abu Dhabi starter-kit data: parcels, districts, transactions",
    "Three local ML models: price/sqm, parcel value, development potential",
    "Transparent ROI rules -> success score + recommendation",
    "Plain-language reasons and warnings - not a black box",
    "Triage aid for demo; not a real purchase decision"
) 40 100 520 380 17
Add-Picture $s5 $Dash 580 90 340 | Out-Null

# --- Slide 6: Beach risks ---
$s6 = $pres.Slides.Add(6, 12)
Set-DarkBackground $s6 15 23 42
Add-TitleText $s6 "Beach-Facing Investor Risks We Surface" 40 30 880 50 28 $true 245 240 232
Add-BodyText $s6 @(
    "View premium -> higher entry price and compressed gross yield",
    "Salt air and humidity -> higher maintenance and capex over time",
    "Seasonal occupancy -> churn and reputation volatility",
    "Regulatory limits -> harder redevelopment on waterfront parcels",
    "Coastal risk layer adjusts scores and adds due-diligence warnings"
) 40 100 520 380 17
Add-Picture $s6 $Hero 580 90 340 | Out-Null

# --- Slide 7: Tenant simulator ---
$s7 = $pres.Slides.Add(7, 12)
Set-DarkBackground $s7 15 23 42
Add-TitleText $s7 "Tenant Simulator - How It Works" 40 30 880 50 28 $true 245 240 232
Add-BodyText $s7 @(
    "Demo building: 2 floors, 6 units, ~8 AI characters with unique personas",
    "Residents propose actions; game master validates outcomes",
    "Landlord handles repairs, complaints, rent, and move-ins",
    "Tracks satisfaction, trust, maintenance pressure, and budget",
    "Connects operational reality to investor ROI"
) 40 100 520 380 17
Add-Picture $s7 $Sim 580 90 340 | Out-Null

# --- Slide 8: Flow ---
$s8 = $pres.Slides.Add(8, 12)
Set-DarkBackground $s8 15 23 42
Add-TitleText $s8 "End-to-End Flow" 40 30 880 50 32 $true 245 240 232
$steps = @(
    @("Data", "Synthetic CSVs`nDistricts + Parcels"),
    @("ML Models", "Value + Yield +`nPotential"),
    @("ROI Rules", "Margin + Score +`nWarnings"),
    @("Simulator", "Tenant life +`nLandlord"),
    @("Decision", "Invest & manage`nwith evidence")
)
$x = 30
foreach ($step in $steps) {
    $box = $s8.Shapes.AddShape(1, $x, 130, 165, 120)
    $box.Fill.ForeColor.RGB = (59 -shl 16) -bor (41 -shl 8) -bor 30
    $box.Line.ForeColor.RGB = (150 -shl 16) -bor (184 -shl 8) -bor 201
    Add-TitleText $s8 $step[0] ($x + 10) 145 145 30 14 $true 245 240 232
    Add-TitleText $s8 $step[1] ($x + 10) 180 145 50 11 $false 148 163 184
    $x += 180
}

# --- Slide 9: Tech ---
$s9 = $pres.Slides.Add(9, 12)
Set-DarkBackground $s9 15 23 42
Add-TitleText $s9 "Tech Stack" 40 30 880 50 32 $true 245 240 232
Add-BodyText $s9 @(
    "Next.js 14 + TypeScript + Tailwind - demo dashboard and API routes",
    "Python ML pipeline - CatBoost and XGBoost, ONNX export option",
    "Agent harness - character, landlord, and game master agents with LLM hooks",
    "Phaser (planned) - visual building panel for the tenant simulator",
    "Local-first demo - runs without paid APIs"
) 40 100 880 380 20

# --- Slide 10: Demo script ---
$s10 = $pres.Slides.Add(10, 12)
Set-DarkBackground $s10 15 23 42
Add-TitleText $s10 "3-Minute Demo Script" 40 30 880 50 32 $true 245 240 232
Add-BodyText $s10 @(
    "Frame the problem: beach views do not guarantee returns",
    "Open dashboard and fetch recommendation for a waterfront parcel",
    "Show score, margin, yield, and coastal warnings",
    "Explain tenant sim: how management erodes ROI after purchase",
    "Close: synthetic data, transparent logic, decision support not autopilot"
) 40 100 520 380 17
Add-Picture $s10 $Dash 580 90 340 | Out-Null

# --- Slide 11: Thank you ---
$s11 = $pres.Slides.Add(11, 12)
Set-DarkBackground $s11 30 41 59
Add-TitleText $s11 "Thank You" 40 120 520 80 40 $true 245 240 232
Add-BodyText $s11 @(
    "The Sims 5 Real Estate",
    "Building the intelligence layer for land, investment, and communities",
    "Questions?"
) 40 220 520 200 22
Add-Picture $s11 $Sim 580 100 340 | Out-Null

# Save
if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
$pres.SaveAs($OutFile)
$pres.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null

Write-Output "Saved: $OutFile"
