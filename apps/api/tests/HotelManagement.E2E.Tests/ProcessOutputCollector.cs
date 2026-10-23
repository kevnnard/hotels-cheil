using System.Text;

namespace HotelManagement.E2E.Tests;

public sealed class ProcessOutputCollector
{
    private readonly StringBuilder captured = new();
    private readonly object gate = new();
    private readonly TaskCompletionSource completed = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private int openStreams;

    public ProcessOutputCollector(int streamCount)
    {
        openStreams = streamCount;
    }

    public Task Completion => completed.Task;

    public void Append(string line)
    {
        lock (gate)
        {
            captured.AppendLine(line);
        }
    }

    public void SignalEndOfStream()
    {
        if (Interlocked.Decrement(ref openStreams) == 0)
        {
            completed.TrySetResult();
        }
    }

    public string Text
    {
        get
        {
            lock (gate)
            {
                return captured.ToString();
            }
        }
    }
}
