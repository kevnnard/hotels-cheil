namespace HotelManagement.Domain;

public sealed class DomainValidationException(string message) : Exception(message);
