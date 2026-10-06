# Vía B': servidor estático sin ningún .exe, para cuando Windows bloquea los
# ejecutables sin firma. Solo escucha en localhost (no pide administrador).
#
# El servidor atiende una petición a la vez. Para que el video no acapare la
# conexión, las peticiones por rango abiertas se sirven en trozos de 4 MB; el
# navegador pide el siguiente trozo solo.
param(
  [int]$Puerto = 4173,
  [string]$Raiz = (Join-Path $PSScriptRoot 'web')
)

$ErrorActionPreference = 'Stop'
$Raiz = (Resolve-Path -LiteralPath $Raiz).Path.TrimEnd('\') + '\'
$TROZO = 4MB

$tipos = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.webp' = 'image/webp'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.mp4' = 'video/mp4'; '.webm' = 'video/webm'; '.ttf' = 'font/ttf'
  '.otf' = 'font/otf'; '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.txt' = 'text/plain; charset=utf-8'
}

$escucha = [System.Net.HttpListener]::new()
$escucha.Prefixes.Add("http://localhost:$Puerto/")
$escucha.Start()
Write-Host "Sirviendo $Raiz en http://localhost:$Puerto/  (cierra esta ventana para detener)"

while ($escucha.IsListening) {
  $contexto = $escucha.GetContext()
  $peticion = $contexto.Request
  $respuesta = $contexto.Response
  try {
    $relativa = [Uri]::UnescapeDataString($peticion.Url.AbsolutePath).TrimStart('/')
    if ($relativa -eq '') { $relativa = 'index.html' }
    $archivo = [IO.Path]::GetFullPath((Join-Path $Raiz $relativa))

    if (-not $archivo.StartsWith($Raiz, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($archivo)) {
      $respuesta.StatusCode = 404
      continue
    }

    $extension = [IO.Path]::GetExtension($archivo).ToLowerInvariant()
    $respuesta.ContentType = if ($tipos.ContainsKey($extension)) { $tipos[$extension] } else { 'application/octet-stream' }
    $respuesta.Headers['Accept-Ranges'] = 'bytes'
    $respuesta.Headers['Cache-Control'] = 'no-cache'

    $flujo = [IO.File]::OpenRead($archivo)
    try {
      $tamano = $flujo.Length
      $inicio = [int64]0
      $fin = $tamano - 1
      $rango = $peticion.Headers['Range']

      if ($rango -match '^bytes=(\d*)-(\d*)$') {
        if ($Matches[1] -eq '') {
          $inicio = [Math]::Max([int64]0, $tamano - [int64]$Matches[2])
        } else {
          $inicio = [int64]$Matches[1]
          $fin = if ($Matches[2] -ne '') { [Math]::Min([int64]$Matches[2], $tamano - 1) } else { [Math]::Min($inicio + $TROZO - 1, $tamano - 1) }
        }
        if ($inicio -gt $fin) {
          $respuesta.StatusCode = 416
          $respuesta.Headers['Content-Range'] = "bytes */$tamano"
          continue
        }
        $respuesta.StatusCode = 206
        $respuesta.Headers['Content-Range'] = "bytes $inicio-$fin/$tamano"
      }

      $pendiente = $fin - $inicio + 1
      $respuesta.ContentLength64 = $pendiente
      [void]$flujo.Seek($inicio, [IO.SeekOrigin]::Begin)
      $bufer = New-Object byte[] 65536
      while ($pendiente -gt 0) {
        $leidos = $flujo.Read($bufer, 0, [int][Math]::Min($bufer.Length, $pendiente))
        if ($leidos -le 0) { break }
        $respuesta.OutputStream.Write($bufer, 0, $leidos)
        $pendiente -= $leidos
      }
    } finally {
      $flujo.Dispose()
    }
  } catch {
    # El navegador cortó la conexión (p. ej. al saltar en el video): se ignora y se sigue sirviendo.
  } finally {
    try { $respuesta.Close() } catch { }
  }
}
