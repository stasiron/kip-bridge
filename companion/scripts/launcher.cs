using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

/// <summary>
/// Double-click host for the packaged bridge. Starts the bundled Node process,
/// opens the loopback host page, and kills the whole tree on Stop or close.
/// </summary>
static class Native
{
    public const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;

    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct IO_COUNTERS
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetInformationJobObject(
        IntPtr hJob,
        int JobObjectInfoClass,
        ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION lpJobObjectInfo,
        uint cbJobObjectInfoLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);
}

sealed class MainForm : Form
{
    public const string MutexName = "Local\\KIP-Browser-Bridge-Host";
    const string HostUrl = "http://127.0.0.1:8787/host";

    readonly Label statusLabel;
    readonly Label codeLabel;
    readonly TextBox logBox;
    readonly Button startButton;
    readonly Button stopButton;
    readonly Button openButton;
    readonly string dir;
    readonly string nodePath;
    readonly string scriptPath;

    Process child;
    IntPtr job = IntPtr.Zero;
    string joinCode = "";
    bool openingBrowser;

    public MainForm()
    {
        dir = AppDomain.CurrentDomain.BaseDirectory;
        nodePath = Path.Combine(dir, "node.exe");
        scriptPath = Path.Combine(dir, "bridge.cjs");

        Text = "Knowledge Is Power — most PC";
        Width = 520;
        Height = 480;
        MinimumSize = new Size(420, 360);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10f);
        BackColor = Color.FromArgb(7, 20, 31);
        ForeColor = Color.FromArgb(231, 246, 248);
        FormClosing += OnFormClosing;

        var title = new Label
        {
            Text = "Most Knowledge Is Power",
            AutoSize = false,
            Dock = DockStyle.Top,
            Height = 36,
            Font = new Font("Segoe UI", 16f, FontStyle.Bold),
            Padding = new Padding(16, 12, 16, 0),
        };

        statusLabel = new Label
        {
            Text = "Gotowy. Naciśnij Włącz.",
            AutoSize = false,
            Dock = DockStyle.Top,
            Height = 28,
            Padding = new Padding(16, 4, 16, 0),
        };

        codeLabel = new Label
        {
            Text = "Kod: —",
            AutoSize = false,
            Dock = DockStyle.Top,
            Height = 48,
            Font = new Font("Consolas", 22f, FontStyle.Bold),
            Padding = new Padding(16, 4, 16, 0),
        };

        var buttonRow = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 52,
            Padding = new Padding(12, 8, 12, 8),
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
        };

        startButton = MakeButton("Włącz", Color.FromArgb(16, 90, 70));
        stopButton = MakeButton("Wyłącz", Color.FromArgb(120, 40, 40));
        openButton = MakeButton("Otwórz QR / kod", Color.FromArgb(16, 60, 90));
        stopButton.Enabled = false;
        openButton.Enabled = false;
        startButton.Click += (_, __) => StartBridge();
        stopButton.Click += (_, __) => StopBridge("Zatrzymane.");
        openButton.Click += (_, __) => OpenHostPage();
        buttonRow.Controls.Add(startButton);
        buttonRow.Controls.Add(stopButton);
        buttonRow.Controls.Add(openButton);

        var hint = new Label
        {
            Text = "1. Włącz  2. Zezwól na sieć prywatną jeśli Windows zapyta  3. Telefon skanuje QR i wpisuje kod  4. Wyłącz na koniec",
            AutoSize = false,
            Dock = DockStyle.Top,
            Height = 48,
            Padding = new Padding(16, 4, 16, 0),
        };

        logBox = new TextBox
        {
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Vertical,
            Dock = DockStyle.Fill,
            Font = new Font("Consolas", 9f),
            BackColor = Color.FromArgb(12, 30, 44),
            ForeColor = Color.FromArgb(231, 246, 248),
            BorderStyle = BorderStyle.FixedSingle,
        };

        var logHost = new Panel { Dock = DockStyle.Fill, Padding = new Padding(16, 8, 16, 16) };
        logHost.Controls.Add(logBox);

        Controls.Add(logHost);
        Controls.Add(hint);
        Controls.Add(buttonRow);
        Controls.Add(codeLabel);
        Controls.Add(statusLabel);
        Controls.Add(title);

        Shown += (_, __) =>
        {
            if (!FolderLooksComplete())
            {
                statusLabel.Text = "Folder niekompletny.";
                AppendLog("Brakuje node.exe, bridge.cjs albo web\\index.html. Rozpakuj cały folder zip.");
                startButton.Enabled = false;
                return;
            }
            StartBridge();
        };
    }

    static Button MakeButton(string text, Color back)
    {
        return new Button
        {
            Text = text,
            Width = 140,
            Height = 34,
            FlatStyle = FlatStyle.Flat,
            BackColor = back,
            ForeColor = Color.White,
            Margin = new Padding(4, 0, 4, 0),
        };
    }

    bool FolderLooksComplete()
    {
        return File.Exists(nodePath)
            && File.Exists(scriptPath)
            && File.Exists(Path.Combine(dir, "web", "index.html"));
    }

    void StartBridge()
    {
        if (child != null && !child.HasExited) return;
        if (!FolderLooksComplete())
        {
            MessageBox.Show(
                this,
                "Folder niekompletny. Trzymaj KIP-Bridge.exe obok node.exe, bridge.cjs i folderu web.",
                Text,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        joinCode = "";
        codeLabel.Text = "Kod: …";
        openingBrowser = false;
        logBox.Clear();
        AppendLog("Uruchamianie mostu…");

        EnsureJob();
        var start = new ProcessStartInfo
        {
            FileName = nodePath,
            Arguments = "\"" + scriptPath + "\"",
            WorkingDirectory = dir,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        start.EnvironmentVariables["KIP_BRIDGE_LAUNCH"] = "1";

        try
        {
            child = new Process { StartInfo = start, EnableRaisingEvents = true };
            child.OutputDataReceived += (_, e) =>
            {
                if (e.Data != null) BeginInvoke(new Action(() => OnBridgeLine(e.Data)));
            };
            child.ErrorDataReceived += (_, e) =>
            {
                if (e.Data != null) BeginInvoke(new Action(() => OnBridgeLine(e.Data)));
            };
            child.Exited += (_, __) =>
            {
                try
                {
                    BeginInvoke(new Action(OnBridgeExited));
                }
                catch (InvalidOperationException)
                {
                    // Form already gone.
                }
            };
            if (!child.Start())
            {
                AppendLog("Nie udało się uruchomić node.exe.");
                statusLabel.Text = "Błąd startu.";
                child = null;
                return;
            }
            if (job != IntPtr.Zero && !Native.AssignProcessToJobObject(job, child.Handle))
            {
                AppendLog("Ostrzeżenie: nie przypisano procesu do job object (zamknięcie okna może zostawić node).");
            }
            child.BeginOutputReadLine();
            child.BeginErrorReadLine();
            startButton.Enabled = false;
            stopButton.Enabled = true;
            openButton.Enabled = true;
            statusLabel.Text = "Most działa. Czekam na kod…";
        }
        catch (Exception ex)
        {
            AppendLog("Błąd: " + ex.Message);
            statusLabel.Text = "Błąd startu.";
            child = null;
        }
    }

    void OnBridgeLine(string line)
    {
        AppendLog(line);
        var match = Regex.Match(line, @"Join code:\s*([A-Z2-9]{8})");
        if (match.Success)
        {
            joinCode = match.Groups[1].Value;
            codeLabel.Text = "Kod: " + joinCode;
            statusLabel.Text = "Most działa. Kod jest też na stronie hosta.";
            if (!openingBrowser)
            {
                openingBrowser = true;
                OpenHostPage();
            }
        }
        if (line.IndexOf("already in use", StringComparison.OrdinalIgnoreCase) >= 0
            || line.IndexOf("EADDRINUSE", StringComparison.OrdinalIgnoreCase) >= 0)
        {
            statusLabel.Text = "Port 8787 zajęty. Wyłącz drugą kopię mostu.";
        }
    }

    void OnBridgeExited()
    {
        int code = -1;
        try
        {
            if (child != null) code = child.ExitCode;
        }
        catch
        {
            // ignored
        }
        child = null;
        startButton.Enabled = true;
        stopButton.Enabled = false;
        if (string.IsNullOrEmpty(joinCode))
            statusLabel.Text = "Most się zatrzymał (kod " + code + ").";
        else
            statusLabel.Text = "Most wyłączony.";
        AppendLog("Proces mostu zakończony.");
    }

    void StopBridge(string status)
    {
        var proc = child;
        child = null;
        if (proc != null)
        {
            try
            {
                if (!proc.HasExited)
                {
                    KillTree(proc.Id);
                    if (!proc.WaitForExit(4000))
                    {
                        try { proc.Kill(); } catch { /* ignore */ }
                        proc.WaitForExit(2000);
                    }
                }
            }
            catch (Exception ex)
            {
                AppendLog("Stop: " + ex.Message);
            }
            try { proc.Dispose(); } catch { /* ignore */ }
        }
        startButton.Enabled = true;
        stopButton.Enabled = false;
        statusLabel.Text = status;
        AppendLog(status);
    }

    static void KillTree(int pid)
    {
        try
        {
            var kill = new ProcessStartInfo
            {
                FileName = "taskkill",
                Arguments = "/T /F /PID " + pid,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using (var p = Process.Start(kill))
            {
                if (p != null) p.WaitForExit(5000);
            }
        }
        catch
        {
            // ignored
        }
    }

    void OpenHostPage()
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = HostUrl,
                UseShellExecute = true,
            });
        }
        catch (Exception ex)
        {
            AppendLog("Nie otwarto przeglądarki: " + ex.Message);
            AppendLog("Otwórz ręcznie: " + HostUrl);
        }
    }

    void EnsureJob()
    {
        if (job != IntPtr.Zero) return;
        job = Native.CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) return;
        var info = new Native.JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = Native.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if (!Native.SetInformationJobObject(
            job,
            9,
            ref info,
            (uint)Marshal.SizeOf(typeof(Native.JOBOBJECT_EXTENDED_LIMIT_INFORMATION))))
        {
            Native.CloseHandle(job);
            job = IntPtr.Zero;
        }
    }

    void OnFormClosing(object sender, FormClosingEventArgs e)
    {
        StopBridge("Zamykanie…");
        if (job != IntPtr.Zero)
        {
            Native.CloseHandle(job);
            job = IntPtr.Zero;
        }
    }

    void AppendLog(string line)
    {
        if (logBox.TextLength > 20000)
            logBox.Text = logBox.Text.Substring(logBox.TextLength - 12000);
        logBox.AppendText(line + Environment.NewLine);
    }
}

static class Entry
{
    [STAThread]
    static int Main()
    {
        bool createdNew;
        using (var mutex = new Mutex(true, MainForm.MutexName, out createdNew))
        {
            if (!createdNew)
            {
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "http://127.0.0.1:8787/host",
                        UseShellExecute = true,
                    });
                }
                catch
                {
                    MessageBox.Show(
                        "Most już działa. Otwórz w przeglądarce:\nhttp://127.0.0.1:8787/host",
                        "Knowledge Is Power",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                }
                return 0;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
            GC.KeepAlive(mutex);
            return 0;
        }
    }
}
