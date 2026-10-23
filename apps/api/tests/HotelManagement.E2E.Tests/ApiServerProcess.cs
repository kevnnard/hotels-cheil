using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;

namespace HotelManagement.E2E.Tests;

public sealed class ApiServerProcess : IAsyncDisposable
{
    private readonly Process process;
    private readonly StringBuilder captured = new();
    private readonly object capturedLock = new();
    private readonly string[] secrets;

    private ApiServerProcess(Process process, Uri baseAddress, string[] secrets)
    {
        this.process = process;
        this.secrets = secrets;
        BaseAddress = baseAddress;
        this.process.OutputDataReceived += Append;
        this.process.ErrorDataReceived += Append;
    }

    public Uri BaseAddress { get; }

    public bool HasExited => process.HasExited;

    public int ExitCode => process.HasExited ? process.ExitCode : -1;

    public string CapturedOutput
    {
        get
        {
            lock (capturedLock)
            {
                return Redact(captured.ToString());
            }
        }
    }

    public static Task<ApiServerProcess> StartAsync(string environment, IReadOnlyDictionary<string, string> settings)
    {
        var port = FreePort();
        var baseAddress = new Uri($"http://127.0.0.1:{port}");
        var assembly = ApiAssemblyPath();

        var startInfo = new ProcessStartInfo
        {
            FileName = DotnetHost(),
            WorkingDirectory = Path.GetDirectoryName(assembly)!,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        startInfo.ArgumentList.Add("exec");
        startInfo.ArgumentList.Add(assembly);
        startInfo.ArgumentList.Add("--urls");
        startInfo.ArgumentList.Add(baseAddress.ToString());
        startInfo.Environment["ASPNETCORE_ENVIRONMENT"] = environment;
        startInfo.Environment["DOTNET_ENVIRONMENT"] = environment;

        foreach (var setting in settings)
        {
            startInfo.Environment[setting.Key] = setting.Value;
        }

        var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        var server = new ApiServerProcess(
            process,
            baseAddress,
            settings.Values.Where(value => value.Length >= 12).ToArray());

        try
        {
            process.Start();
        }
        catch (Exception exception)
        {
            process.Dispose();
            throw new InvalidOperationException("The API process could not be started.", exception);
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        return Task.FromResult(server);
    }

    public async Task WaitForExitAsync(TimeSpan timeout)
    {
        using var cancellation = new CancellationTokenSource(timeout);
        await process.WaitForExitAsync(cancellation.Token);
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                await process.WaitForExitAsync();
            }
        }
        catch (InvalidOperationException)
        {
        }

        process.Dispose();
    }

    private void Append(object sender, DataReceivedEventArgs arguments)
    {
        if (arguments.Data is null)
        {
            return;
        }

        lock (capturedLock)
        {
            captured.AppendLine(arguments.Data);
        }
    }

    private string Redact(string text)
    {
        var redacted = text;
        foreach (var secret in secrets)
        {
            redacted = redacted.Replace(secret, "***", StringComparison.Ordinal);
        }

        return redacted;
    }

    private static string ApiAssemblyPath()
    {
        var metadata = typeof(ApiServerProcess).Assembly
            .GetCustomAttributes<AssemblyMetadataAttribute>()
            .FirstOrDefault(attribute => attribute.Key == "HotelApiAssemblyPath");

        if (metadata is null || string.IsNullOrWhiteSpace(metadata.Value))
        {
            throw new InvalidOperationException("The HotelApiAssemblyPath assembly metadata is missing.");
        }

        var path = Path.GetFullPath(metadata.Value);
        if (!File.Exists(path))
        {
            throw new FileNotFoundException(
                "The API assembly was not found. Build the solution before running the end-to-end tests.",
                path);
        }

        return path;
    }

    private static string DotnetHost()
    {
        var host = Environment.GetEnvironmentVariable("DOTNET_HOST_PATH");
        return !string.IsNullOrWhiteSpace(host) && File.Exists(host) ? host : "dotnet";
    }

    private static int FreePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        try
        {
            return ((IPEndPoint)listener.LocalEndpoint).Port;
        }
        finally
        {
            listener.Stop();
        }
    }
}
