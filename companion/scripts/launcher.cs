using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

class Program
{
    [DllImport("kernel32.dll")]
    static extern bool SetConsoleOutputCP(uint codePage);

    [DllImport("kernel32.dll")]
    static extern bool SetConsoleCP(uint codePage);

    static int Main()
    {
        SetConsoleOutputCP(65001);
        SetConsoleCP(65001);
        Console.OutputEncoding = Encoding.UTF8;

        string dir = AppDomain.CurrentDomain.BaseDirectory;
        string node = Path.Combine(dir, "node.exe");
        string script = Path.Combine(dir, "bridge.cjs");
        if (!File.Exists(node) || !File.Exists(script) || !File.Exists(Path.Combine(dir, "web", "index.html")))
        {
            Console.Error.WriteLine("This folder is incomplete. Keep KIP-Bridge.exe beside node.exe, bridge.cjs, and the web folder.");
            return 1;
        }

        var start = new ProcessStartInfo
        {
            FileName = node,
            Arguments = "\"" + script + "\"",
            WorkingDirectory = dir,
            UseShellExecute = false,
        };
        start.EnvironmentVariables["KIP_BRIDGE_LAUNCH"] = "1";

        try
        {
            var child = Process.Start(start);
            if (child == null)
            {
                Console.Error.WriteLine("Could not start the bridge runtime.");
                return 1;
            }
            child.WaitForExit();
            return child.ExitCode;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Could not start the bridge: " + ex.Message);
            return 1;
        }
    }
}
