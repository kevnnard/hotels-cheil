namespace HotelManagement.E2E.Tests;

public sealed class ProcessOutputCollectorTests
{
    [Fact]
    public async Task The_output_is_complete_only_after_every_stream_ends()
    {
        var collector = new ProcessOutputCollector(2);
        collector.Append("the first line");
        collector.SignalEndOfStream();

        Assert.False(collector.Completion.IsCompleted);

        collector.SignalEndOfStream();

        await collector.Completion.WaitAsync(TimeSpan.FromSeconds(5));

        Assert.Contains("the first line", collector.Text);
    }

    [Fact]
    public void The_collected_text_keeps_every_line()
    {
        var collector = new ProcessOutputCollector(1);
        collector.Append("first");
        collector.Append("second");

        Assert.Equal($"first{Environment.NewLine}second{Environment.NewLine}", collector.Text);
    }
}
