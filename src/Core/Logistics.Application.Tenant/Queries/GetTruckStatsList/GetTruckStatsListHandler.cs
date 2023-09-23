﻿using System.Linq.Expressions;
using Logistics.Application.Tenant.Mappers;
using Logistics.Domain.Enums;
using Logistics.Models;

namespace Logistics.Application.Tenant.Queries;

public class GetTruckStatsListHandler : RequestHandler<GetTruckStatsListQuery, PagedResponseResult<TruckStatsDto>>
{
    private readonly ITenantRepository _tenantRepository;

    public GetTruckStatsListHandler(ITenantRepository tenantRepository)
    {
        _tenantRepository = tenantRepository;
    }
    
    protected override Task<PagedResponseResult<TruckStatsDto>> HandleValidated(
        GetTruckStatsListQuery req, CancellationToken cancellationToken)
    {
        var totalItems = _tenantRepository.Query<Truck>().Count();

        var truckStatsQuery = _tenantRepository.Query<Load>()
            .Where(load => load.Status == LoadStatus.Delivered
                           && load.DeliveryDate.HasValue
                           && load.DispatchedDate >= req.StartDate
                           && load.DeliveryDate.Value <= req.EndDate)
            .GroupBy(load => new
            {
                TruckId = load.AssignedTruckId,
                TruckNumber = load.AssignedTruck!.TruckNumber
            })
            .Select(group => new TruckStats
            {
                TruckId = group.Key.TruckId!,
                TruckNumber = group.Key.TruckNumber!,
                Gross = group.Sum(load => load.DeliveryCost),
                Distance = group.Sum(load => load.Distance),
                FirstLoad = group.FirstOrDefault()
            });

        truckStatsQuery = req.Descending
            ? truckStatsQuery.OrderByDescending(InitOrderBy(req.OrderBy))
            : truckStatsQuery.OrderBy(InitOrderBy(req.OrderBy));

        truckStatsQuery = truckStatsQuery
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize);
            
        var truckStatsDto = truckStatsQuery.ToArray()
            .Select(result => new TruckStatsDto
            {
                TruckId = result.TruckId,
                TruckNumber = result.TruckNumber,
                StartDate = req.StartDate,
                EndDate = req.EndDate,
                Gross = result.Gross,
                Distance = result.Distance,
                Drivers = result.FirstLoad?.AssignedTruck?.Drivers.Select(driver => driver.ToDto()) 
                          ?? new List<EmployeeDto>()
            });    

        var totalPages = (int)Math.Ceiling(totalItems / (double)req.PageSize);
        return Task.FromResult(new PagedResponseResult<TruckStatsDto>(truckStatsDto, totalItems, totalPages));
    }
    
    private static Expression<Func<TruckStats, object>> InitOrderBy(string? propertyName)
    {
        propertyName = propertyName?.ToLower() ?? string.Empty;
        return propertyName switch
        {
            "distance" => i => i.Distance,
            "gross" => i => i.Gross,
            _ => i => i.TruckNumber
        };
    }

    private record TruckStats
    {
        public required string TruckId { get; set; }
        public required string TruckNumber { get; set; }
        public required double Gross { get; set; }
        public required double Distance { get; set; }
        public Load? FirstLoad { get; set; }
    }
}