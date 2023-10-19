﻿namespace Logistics.Application.Tenant.Commands;

public class UpdateTruckCommand : Request<ResponseResult>
{
    public string? Id { get; set; }
    public string? TruckNumber { get; set; }
    public string[]? DriverIds { get; set; }
}