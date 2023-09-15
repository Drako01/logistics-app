﻿namespace Logistics.Models;

public class EmployeeDto
{
    public string? Id { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? FullName { get; set; }
    public string? TruckNumber { get; set; }
    public string? TruckId { get; set; }
    public string? LastKnownCoordinates { get; set; }
    public string? LastKnownAddress { get; set; }
    public DateTime JoinedDate { get; set; } = DateTime.UtcNow;
    public IEnumerable<TenantRoleDto>? Roles { get; set; }
}
