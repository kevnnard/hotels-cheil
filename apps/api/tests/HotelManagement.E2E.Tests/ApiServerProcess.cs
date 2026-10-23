using System.Diagnostics;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using Npgsql;

namespace HotelManagement.E2E.Tests;

public sealed class ApiServerProcess : IAsyncDisposable
{
    private static readonly TimeSpan TerminationTimeout = TimeSpan.FromSeconds(10);
    private static readonly Regex ListeningAddress = new(@"Now listening on: (?<url>http://\S+)", RegexOptions.Compiled);

    private readonly Process process;
    private readonly StringBuilder captured = new();
    private readonly object capturedLock = new();
    private readonly string[] secrets;
    private readonly TaskCompletionSource<string> listeningAddress = new(TaskCreationOptions.RunContinuationsAsynchronously);

    private ApiServerProcess(Process process, string[] secrets)
    {
        this.process = process;
        this.secrets = secrets;
        process.OutputDataReceived += Append;
        process.ErrorDataReceived += Append;
    }

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

    public static Task<ApiServerProcess> StartAsync(
        string environment,
        IReadOnlyDictionary<string, string> settings,
        IReadOnlyCollection<string>? removeFromEnvironment = null)
    {
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
        startInfo.ArgumentList.Add("http://127.0.0.1:0");
        startInfo.Environment["ASPNETCORE_ENVIRONMENT"] = environment;
        startInfo.Environment["DOTNET_ENVIRONMENT"] = environment;

        foreach (var removed in removeFromEnvironment ?? Array.Empty<string>())
        {
            startInfo.Environment.Remove(removed);
        }

        foreach (var setting in settings)
        {
            startInfo.Environment[setting.Key] = setting.Value;
        }

        var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        var server = new ApiServerProcess(process, Secrets(settings));

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

    public async Task<Uri> WaitForAddressAsync(TimeSpan timeout)
    {
        var deadline = DateTimeOffset.UtcNow.Add(timeout);

        while (DateTimeOffset.UtcNow < deadline)
        {
            if (process.HasExited)
            {
                throw new InvalidOperationException(
                    $"The API process exited with code {process.ExitCode} before it reported its address. Output: {CapturedOutput}");
            }

            if (listeningAddress.Task.IsCompleted)
            {
                return new Uri(await listeningAddress.Task);
            }

            await Task.Delay(100);
        }

        throw new TimeoutException($"The API process did not report its listening address. Output: {CapturedOutput}");
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
                using var cancellation = new CancellationTokenSource(TerminationTimeout);
                await process.WaitForExitAsync(cancellation.Token);
            }
        }
        catch (InvalidOperationException)
        {
        }
        catch (OperationCanceledException)
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
            var match = ListeningAddress.Match(arguments.Data);
            if (match.Success)
            {
                listeningAddress.TrySetResult(match.Groups["url"].Value);
            }
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

    private static string[] Secrets(IReadOnlyDictionary<string, string> settings) =>
        settings.Select(setting => setting.Value)
            .Where(value => value.Length >= 12)
            .Concat(settings.Where(setting => IsSensitive(setting.Key)).Select(setting => setting.Value))
            .Concat(settings.Where(setting => IsConnectionString(setting.Key)).Select(setting => PasswordOf(setting.Value)))
            .Where(value => value.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

    private static bool IsSensitive(string key) =>
        key.Contains("Password", StringComparison.OrdinalIgnoreCase)
        || key.Contains("SigningKey", StringComparison.OrdinalIgnoreCase)
        || key.Contains("Secret", StringComparison.OrdinalIgnoreCase)
        || key.Contains("Token", StringComparison.OrdinalIgnoreCase);

    private static bool IsConnectionString(string key) =>
        key.Contains("ConnectionStrings", StringComparison.OrdinalIgnoreCase);

    private static string PasswordOf(string connectionString)
    {
        try
        {
            return new NpgsqlConnectionStringBuilder(connectionString).Password ?? string.Empty;
        }
        catch (ArgumentException)
        {
            return string.Empty;
        }
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
}
