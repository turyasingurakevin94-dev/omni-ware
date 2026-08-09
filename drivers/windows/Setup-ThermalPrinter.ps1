<#
.SYNOPSIS
  Finds, tests and installs an 80mm Bluetooth thermal printer on Windows.

.DESCRIPTION
  Pairing a Classic Bluetooth printer in Windows Settings does not give you a
  printer. It gives you two virtual COM ports -- one outgoing, one incoming --
  and says nothing about which is which. Sending to the incoming one does
  nothing at all, silently, which is where most of the time lost to these
  printers goes.

  This script answers the three questions that follow, in order:

    -List      which COM port is the printer's OUTGOING port
    -Test      does that port actually print
    -Install   make it a Windows printer, so ordinary programs can use it

  It needs nothing installed. The self-test page is ESC/POS assembled here,
  because a setup script that depends on the thing being set up is no use on
  the machine where it is needed.

.PARAMETER List
  Show paired Bluetooth devices and their serial ports, marking which are
  outgoing.

.PARAMETER Test
  Send a self-test page to -Port.

.PARAMETER Install
  Add the port as a Windows printer using the built-in "Generic / Text Only"
  driver, so File > Print in any program reaches the printer. Requires
  Administrator.

.PARAMETER Port
  The COM port, e.g. COM5. Omit with -Test or -Install and the script uses
  the outgoing port if there is exactly one.

.PARAMETER PrinterName
  Name for the installed Windows printer. Default: "Omni-Ware Thermal 80mm".

.PARAMETER BaudRate
  Default 9600. Ignored by the Bluetooth link itself, but the port still has
  to be opened with a value, and a wired serial printer on the same script
  does care.

.EXAMPLE
  .\Setup-ThermalPrinter.ps1 -List
.EXAMPLE
  .\Setup-ThermalPrinter.ps1 -Test -Port COM5
.EXAMPLE
  .\Setup-ThermalPrinter.ps1 -Install -Port COM5
#>

[CmdletBinding(DefaultParameterSetName = 'List')]
param(
    [Parameter(ParameterSetName = 'List')]    [switch] $List,
    [Parameter(ParameterSetName = 'Test')]    [switch] $Test,
    [Parameter(ParameterSetName = 'Install')] [switch] $Install,

    [string] $Port,
    [string] $PrinterName = 'Omni-Ware Thermal 80mm',
    [int]    $BaudRate = 9600,
    [int]    $Columns = 48
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Head($text) { Write-Host ''; Write-Host $text -ForegroundColor Cyan; Write-Host ('-' * $text.Length) -ForegroundColor DarkGray }
function Write-Note($text) { Write-Host "  $text" -ForegroundColor DarkGray }

<#
  Outgoing or incoming.

  Windows encodes the answer in the device's PnP instance path, not in its
  name -- both ports are called "Standard Serial over Bluetooth link".

    Outgoing: BTHENUM\{00001101-...}\<address>   -- the SPP service GUID plus
              the remote device's Bluetooth address. This is the one that
              carries bytes TO the printer.
    Incoming: BTHENUM\LOCALMFG&...              -- a listener on this PC.

  So the SPP GUID is what is matched, and the local-manufacturer prefix is
  what is excluded.
#>
$SPP_GUID = '{00001101-0000-1000-8000-00805f9b34fb}'

function Get-BluetoothSerialPorts {
    $ports = @()
    try {
        $devices = Get-PnpDevice -Class Ports -PresentOnly -ErrorAction Stop
    } catch {
        Write-Warning "Could not enumerate ports: $($_.Exception.Message)"
        return $ports
    }

    foreach ($d in $devices) {
        if ($d.FriendlyName -notmatch '\((COM\d+)\)') { continue }
        $com = $Matches[1]
        $id  = $d.InstanceId
        $isBluetooth = $id -like 'BTHENUM*'
        if (-not $isBluetooth) { continue }

        $outgoing = ($id -like "*$SPP_GUID*") -and ($id -notlike '*LOCALMFG*')

        # The remote address is the tail of the instance path, and it is what
        # ties a port to a device in the paired list -- the friendly name is
        # the same for every one of them.
        $address = $null
        if ($id -match '&([0-9A-Fa-f]{12})_C') { $address = $Matches[1] }
        elseif ($id -match '_([0-9A-Fa-f]{12})') { $address = $Matches[1] }

        # Assigned first rather than inline: `Direction = if (...) {...}` inside
        # a hashtable is a PowerShell 7 expression, and Windows still ships 5.1
        # as the one you get by right-clicking Start.
        $direction = 'Incoming'
        if ($outgoing) { $direction = 'Outgoing' }

        $ports += [pscustomobject]@{
            Port        = $com
            Direction   = $direction
            Address     = $address
            Device      = (Get-PairedNameForAddress $address)
            InstanceId  = $id
        }
    }
    return $ports | Sort-Object Direction, Port
}

function Get-PairedNameForAddress($address) {
    if (-not $address) { return '' }
    try {
        $match = Get-PnpDevice -Class Bluetooth -PresentOnly -ErrorAction Stop |
            Where-Object { $_.InstanceId -like "*$address*" -and $_.FriendlyName -notlike 'Bluetooth *' } |
            Select-Object -First 1
        if ($match) { return $match.FriendlyName }
    } catch { }
    return ''
}

function Resolve-Port {
    param([string] $Requested)
    if ($Requested) {
        if ($Requested -notmatch '^COM\d+$') { throw "Port should look like COM5, not '$Requested'." }
        return $Requested.ToUpper()
    }
    $outgoing = @(Get-BluetoothSerialPorts | Where-Object { $_.Direction -eq 'Outgoing' })
    if ($outgoing.Count -eq 1) {
        Write-Note "Using $($outgoing[0].Port) — the only outgoing Bluetooth port."
        return $outgoing[0].Port
    }
    if ($outgoing.Count -eq 0) {
        throw "No outgoing Bluetooth COM port found. Pair the printer in Settings > Bluetooth & devices first, then run -List."
    }
    throw "There are $($outgoing.Count) outgoing Bluetooth ports. Say which one with -Port, e.g. -Port $($outgoing[0].Port)."
}

<#
  The self-test page, as ESC/POS bytes.

  Same intent as the one in the driver: prove the link, prove the code page,
  and above all show how many columns the head really has. The ruler line
  ends exactly at $Columns -- if what comes out wraps onto a second line, the
  printer is narrower than 48 and the app's paper profile needs changing to
  match.
#>
function Get-SelfTestBytes {
    param([int] $Columns = 48)

    $ESC = [char]27; $GS = [char]29
    $sb = New-Object System.Text.StringBuilder

    [void]$sb.Append("$ESC@")                 # initialise
    [void]$sb.Append("${ESC}t" + [char]0)     # code page 437
    [void]$sb.Append("${ESC}a" + [char]1)     # centre
    [void]$sb.Append("${GS}!" + [char]0x11)   # double width + height
    [void]$sb.Append("OMNI-WARE`n")
    [void]$sb.Append("${GS}!" + [char]0)
    [void]$sb.Append("Windows Bluetooth self-test`n")
    [void]$sb.Append("${ESC}a" + [char]0)     # left
    [void]$sb.Append(('-' * $Columns) + "`n")

    [void]$sb.Append("Port     : $script:ResolvedPort`n")
    [void]$sb.Append("Baud     : $BaudRate`n")
    [void]$sb.Append("Computer : $env:COMPUTERNAME`n")
    [void]$sb.Append("When     : " + (Get-Date -Format 'yyyy-MM-dd HH:mm') + "`n")
    [void]$sb.Append(('-' * $Columns) + "`n")

    $ruler = ''
    for ($i = 1; $i -le $Columns; $i++) {
        if ($i % 10 -eq 0) { $ruler += [string](($i / 10) % 10) }
        elseif ($i % 5 -eq 0) { $ruler += '+' }
        else { $ruler += '.' }
    }
    [void]$sb.Append("$ruler`n")
    $tail = '<END|'
    [void]$sb.Append(("column $Columns is").PadRight($Columns - $tail.Length) + $tail + "`n")
    [void]$sb.Append(('-' * $Columns) + "`n")

    [void]$sb.Append("${ESC}E" + [char]1 + "Bold text`n" + "${ESC}E" + [char]0)
    [void]$sb.Append("${GS}!" + [char]0x10 + "Double width`n" + "${GS}!" + [char]0)
    [void]$sb.Append("Money: 1,234,567 UGX`n")
    [void]$sb.Append(('=' * $Columns) + "`n")
    [void]$sb.Append("${ESC}a" + [char]1)
    [void]$sb.Append("If this page reads correctly,`nthe printer is set up.`n")
    [void]$sb.Append("${ESC}a" + [char]0)
    [void]$sb.Append("${ESC}d" + [char]3)     # feed clear of the cutter
    [void]$sb.Append("${GS}V" + [char]66 + [char]0)   # partial cut

    # One byte per character: the printer reads bytes against its own code
    # page, so anything that widens them (UTF-8, and .NET's default in
    # PowerShell 7) turns the control bytes into two-byte sequences and
    # nothing prints.
    $latin1 = [System.Text.Encoding]::GetEncoding(28591)
    return $latin1.GetBytes($sb.ToString())
}

<#
  Writing to the port.

  System.IO.Ports.SerialPort is used rather than `copy /b file COM5` because
  copy leaves the port's settings to whatever they happened to be, and
  because it reports success whether or not anything was written. Opening the
  port explicitly also produces a real error when the port is the incoming
  one or is held by another program -- which is the diagnosis, not a failure.

  DTR and RTS are asserted: some of these printers use them as a "host is
  present" signal and stay silent without.
#>
function Send-ToPort {
    param([string] $Port, [byte[]] $Bytes, [int] $BaudRate)

    # PowerShell 7 needs the assembly loaded; Windows PowerShell 5.1 already
    # has it and rejects the name. Either way the New-Object below is what
    # decides whether this worked, so a failure here is not one.
    try { Add-Type -AssemblyName System.IO.Ports -ErrorAction SilentlyContinue } catch { }

    $sp = New-Object System.IO.Ports.SerialPort $Port, $BaudRate, 'None', 8, 'One'
    $sp.DtrEnable = $true
    $sp.RtsEnable = $true
    $sp.WriteTimeout = 15000
    try {
        $sp.Open()
    } catch {
        throw ("Could not open ${Port}: $($_.Exception.Message)`n" +
               "  * If the printer is switched off, Windows still lists the port — switch it on and retry.`n" +
               "  * If another program (a POS, a printer utility) has the port open, close it.`n" +
               "  * If this is the printer's INCOMING port, use the outgoing one — run -List to see which.")
    }

    try {
        # In chunks, with a pause. The link accepts bytes far faster than the
        # head can burn them and has no flow control to say so; a long job
        # sent in one write comes out with its tail missing.
        $chunk = 256
        for ($offset = 0; $offset -lt $Bytes.Length; $offset += $chunk) {
            $len = [Math]::Min($chunk, $Bytes.Length - $offset)
            $sp.Write($Bytes, $offset, $len)
            Start-Sleep -Milliseconds 30
        }
        Start-Sleep -Milliseconds 400   # let the buffer drain before closing
    } finally {
        $sp.Close()
        $sp.Dispose()
    }
}

function Invoke-List {
    Write-Head 'Paired Bluetooth devices'
    try {
        $bt = Get-PnpDevice -Class Bluetooth -PresentOnly -ErrorAction Stop |
              Where-Object { $_.FriendlyName -notmatch '^(Bluetooth|Microsoft Bluetooth|Intel\(R\) Wireless Bluetooth)' }
        if ($bt) { $bt | Select-Object FriendlyName, Status | Format-Table -AutoSize | Out-Host }
        else { Write-Note 'None found. Pair the printer in Settings > Bluetooth & devices > Add device > Bluetooth.' }
    } catch {
        Write-Note "Could not read Bluetooth devices: $($_.Exception.Message)"
    }

    Write-Head 'Bluetooth serial ports'
    $ports = @(Get-BluetoothSerialPorts)
    if (-not $ports) {
        Write-Note 'None. If the printer is paired but has no COM port, open'
        Write-Note '  Control Panel > Devices and Printers > right-click the printer > Properties > Services,'
        Write-Note '  and tick "Serial port (SPP)".'
    } else {
        $ports | Select-Object Port, Direction, Device, Address | Format-Table -AutoSize | Out-Host
        $out = @($ports | Where-Object { $_.Direction -eq 'Outgoing' })
        if ($out.Count -ge 1) {
            Write-Host ''
            Write-Host "Use the OUTGOING port. Next step:" -ForegroundColor Green
            Write-Host "  .\Setup-ThermalPrinter.ps1 -Test -Port $($out[0].Port)"
        } else {
            Write-Note 'Only incoming ports are present — nothing here sends to a printer.'
            Write-Note 'Re-pair the printer and make sure "Serial port (SPP)" is enabled on it.'
        }
    }

    Write-Head 'Installed printers on a COM port'
    try {
        $p = Get-Printer -ErrorAction Stop | Where-Object { $_.PortName -match '^COM\d+' }
        if ($p) { $p | Select-Object Name, DriverName, PortName | Format-Table -AutoSize | Out-Host }
        else { Write-Note 'None yet. -Install adds one if you want ordinary programs to print to it.' }
    } catch { }
}

function Invoke-Test {
    $script:ResolvedPort = Resolve-Port -Requested $Port
    Write-Head "Self-test to $script:ResolvedPort at $BaudRate baud"
    $bytes = Get-SelfTestBytes -Columns $Columns
    Send-ToPort -Port $script:ResolvedPort -Bytes $bytes -BaudRate $BaudRate
    Write-Host "Sent $($bytes.Length) bytes." -ForegroundColor Green
    Write-Note 'If nothing came out: the port is probably the incoming one — run -List.'
    Write-Note 'If it printed garbage: the baud rate is wrong for a WIRED printer; try -BaudRate 115200.'
    Write-Note "If the ruler wrapped onto a second line: the head is narrower than $Columns columns."
    Write-Note '  Re-run with -Columns 42 (or 32 for a 58mm printer) and set the same profile in the app.'
}

<#
  Installing it as a Windows printer.

  This is what makes the printer usable from programs that only know how to
  print -- including this app's own browser print dialog. "Generic / Text
  Only" is the right driver precisely because it does nothing: it passes text
  through as bytes, which is what an ESC/POS printer wants. A graphics driver
  would rasterise the page and send something the printer cannot read.

  The trade is that Windows printing this way has no idea about cutting,
  double-height totals or the cash drawer. For those, print through the
  driver in this folder over the COM port directly. Both can be set up at
  once and neither interferes with the other.
#>
function Invoke-Install {
    $script:ResolvedPort = Resolve-Port -Requested $Port
    Write-Head "Installing '$PrinterName' on $script:ResolvedPort"

    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
               ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) { throw 'Adding a printer needs Administrator. Re-open PowerShell with "Run as administrator".' }

    $driver = 'Generic / Text Only'
    if (-not (Get-PrinterDriver -Name $driver -ErrorAction SilentlyContinue)) {
        Write-Note "Adding the '$driver' driver."
        Add-PrinterDriver -Name $driver
    }

    # A COM port is not automatically a PRINTER port. Adding it as a local
    # port with the trailing colon is what puts it in the list Add-Printer
    # will accept.
    $portName = "$($script:ResolvedPort):"
    if (-not (Get-PrinterPort -Name $portName -ErrorAction SilentlyContinue)) {
        Write-Note "Adding printer port $portName."
        Add-PrinterPort -Name $portName
    }

    if (Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue) {
        Write-Note "'$PrinterName' already exists — pointing it at $portName."
        Set-Printer -Name $PrinterName -PortName $portName -DriverName $driver
    } else {
        Add-Printer -Name $PrinterName -DriverName $driver -PortName $portName
    }

    Write-Host "Installed. '$PrinterName' now prints to $script:ResolvedPort." -ForegroundColor Green
    Write-Note 'Set the paper size on it to 80 x 297mm (Printer properties > Advanced) or long receipts will be cut short.'
    Write-Note 'For cutting, double-height totals and the cash drawer, print over the COM port instead — see ..\README.md.'
}

$script:ResolvedPort = $Port

switch ($PSCmdlet.ParameterSetName) {
    'Test'    { Invoke-Test }
    'Install' { Invoke-Install }
    default   { Invoke-List }
}
