ARG SDK_VERSION=10.0.402
ARG RUNTIME_VERSION=10.0

FROM mcr.microsoft.com/dotnet/sdk:${SDK_VERSION} AS restore
WORKDIR /src
COPY apps/api/global.json ./
COPY apps/api/src/HotelManagement.Domain/HotelManagement.Domain.csproj src/HotelManagement.Domain/
COPY apps/api/src/HotelManagement.Application/HotelManagement.Application.csproj src/HotelManagement.Application/
COPY apps/api/src/HotelManagement.Infrastructure/HotelManagement.Infrastructure.csproj src/HotelManagement.Infrastructure/
COPY apps/api/src/HotelManagement.Api/HotelManagement.Api.csproj src/HotelManagement.Api/
RUN dotnet restore src/HotelManagement.Api/HotelManagement.Api.csproj

FROM restore AS dev
ENV DOTNET_USE_POLLING_FILE_WATCHER=1
COPY apps/api/src ./src
EXPOSE 8080
ENTRYPOINT ["dotnet", "watch", "run", "--project", "src/HotelManagement.Api/HotelManagement.Api.csproj", "--no-launch-profile", "--urls", "http://0.0.0.0:8080"]

FROM restore AS publish
COPY apps/api/src ./src
RUN dotnet publish src/HotelManagement.Api/HotelManagement.Api.csproj -c Release --no-restore -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:${RUNTIME_VERSION} AS runtime
WORKDIR /app
COPY --from=publish /app/publish ./
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "HotelManagement.Api.dll"]
