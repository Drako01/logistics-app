﻿using Logistics.Application.Common;
using Logistics.Models;
using Logistics.Shared;

namespace Logistics.Application.Admin.Queries;

public sealed class GetUserByIdQuery : Request<ResponseResult<UserDto>>
{
    public required string UserId { get; set; }
}
