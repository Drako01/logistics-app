﻿namespace Logistics.Models;

public class NotificationDto
{
    public string? Title { get; set; }
    public string? Message { get; set; }
    public bool IsRead { get; set; }
    public DateTime Created { get; set; }
}
