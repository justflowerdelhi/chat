<%@ Language=VBScript %>
<%
Option Explicit

Response.ContentType = "application/json"
Response.Charset = "utf-8"

Dim vPath, pPath, ConString, root
Dim Conn, rsProducts, strSQL
Dim maxProducts, cityFilter, categoryFilter, maxPrice
Dim sqlWhere, json, firstItem
Dim imagePath, imageUrl, productUrl

' Same database used by the existing JustFlower website
vPath = "database\cdi.mdb"
pPath = Server.MapPath(vPath)
ConString = "PROVIDER=MICROSOFT.JET.OLEDB.4.0;DATA SOURCE=" & pPath & ";" & "JET OLEDB:Database Password=foo"
root = "https://justflower.in/"

maxProducts = 500
cityFilter = Trim(Request.QueryString("city"))
categoryFilter = Trim(Request.QueryString("category"))
maxPrice = Trim(Request.QueryString("max_price"))

sqlWhere = ""

If Len(cityFilter) > 0 Then
    cityFilter = Replace(cityFilter, "'", "''")
    sqlWhere = sqlWhere & " WHERE (city LIKE '%" & cityFilter & "%' OR splcity LIKE '%" & cityFilter & "%') "
End If

If Len(categoryFilter) > 0 Then
    categoryFilter = Replace(categoryFilter, "'", "''")
    If Len(sqlWhere) = 0 Then
        sqlWhere = " WHERE page LIKE '%" & categoryFilter & "%' "
    Else
        sqlWhere = sqlWhere & " AND page LIKE '%" & categoryFilter & "%' "
    End If
End If

If Len(maxPrice) > 0 And IsNumeric(maxPrice) Then
    If Len(sqlWhere) = 0 Then
        sqlWhere = " WHERE productPrice <= " & Replace(CStr(CDbl(maxPrice)), ",", ".") & " "
    Else
        sqlWhere = sqlWhere & " AND productPrice <= " & Replace(CStr(CDbl(maxPrice)), ",", ".") & " "
    End If
End If

On Error Resume Next

Set Conn = Server.CreateObject("ADODB.Connection")
Conn.Open ConString

If Err.Number <> 0 Then
    SendError "Database connection failed: " & Err.Description
    Response.End
End If

Err.Clear

strSQL = "SELECT TOP " & maxProducts & _
         " productID, product, productName, productDesc, offer, productImg, " & _
         "productPrice, page, catalogID, link, category, city, splcity " & _
         "FROM products" & sqlWhere & _
         " ORDER BY catalogID ASC"

Set rsProducts = Server.CreateObject("ADODB.Recordset")
rsProducts.Open strSQL, Conn, 3, 1

If Err.Number <> 0 Then
    SendError "Catalogue query failed: " & Err.Description
    Response.End
End If

On Error GoTo 0

json = "{""success"":true,""products"":["
firstItem = True

Do Until rsProducts.EOF

    If Not firstItem Then json = json & ","
    firstItem = False

    imagePath = Trim(CStr(rsProducts("productImg") & ""))
    imageUrl = ""

    If Len(imagePath) > 0 Then
        imagePath = Replace(imagePath, "\", "/")

        If LCase(Left(imagePath, 7)) = "http://" Or LCase(Left(imagePath, 8)) = "https://" Then
            imageUrl = imagePath
        ElseIf Left(imagePath, 1) = "/" Then
            imageUrl = Left(root, Len(root) - 1) & imagePath
        Else
            imageUrl = root & imagePath
        End If

        ' Your database stores image/FDI-315 without the extension.
        If InStrRev(imageUrl, ".") = 0 Then
            imageUrl = imageUrl & ".jpg"
        End If
    End If

    productUrl = Trim(CStr(rsProducts("link") & ""))

    If Len(productUrl) > 0 Then
        If LCase(Left(productUrl, 7)) <> "http://" And LCase(Left(productUrl, 8)) <> "https://" Then
            If Left(productUrl, 1) = "/" Then
                productUrl = Left(root, Len(root) - 1) & productUrl
            Else
                productUrl = root & productUrl
            End If
        End If
    End If

    json = json & "{"
    json = json & """id"":""" & JsonEscape(rsProducts("productID")) & ""","
    json = json & """code"":""" & JsonEscape(rsProducts("product")) & ""","
    json = json & """name"":""" & JsonEscape(rsProducts("productName")) & ""","
    json = json & """description"":""" & JsonEscape(rsProducts("productDesc")) & ""","
    json = json & """offer"":""" & JsonEscape(rsProducts("offer")) & ""","
    json = json & """price"":" & JsonNumber(rsProducts("productPrice")) & ","
    json = json & """image"":""" & JsonEscape(imageUrl) & ""","
    json = json & """url"":""" & JsonEscape(productUrl) & ""","
    json = json & """category"":""" & JsonEscape(rsProducts("category")) & ""","
    json = json & """city"":""" & JsonEscape(rsProducts("city")) & ""","
    json = json & """specialCity"":""" & JsonEscape(rsProducts("splcity")) & ""","
    json = json & """tags"":""" & JsonEscape(rsProducts("page")) & """"
    json = json & "}"

    rsProducts.MoveNext
Loop

json = json & "],""count"":" & CountRecords(rsProducts) & "}"
Response.Write json

If Not rsProducts Is Nothing Then
    If rsProducts.State = 1 Then rsProducts.Close
End If
If Not Conn Is Nothing Then
    If Conn.State = 1 Then Conn.Close
End If

Set rsProducts = Nothing
Set Conn = Nothing

Function JsonEscape(value)
    Dim s
    If IsNull(value) Then
        JsonEscape = ""
        Exit Function
    End If

    s = CStr(value)
    s = Replace(s, Chr(92), Chr(92) & Chr(92))
    s = Replace(s, Chr(34), Chr(92) & Chr(34))
    s = Replace(s, vbCrLf, Chr(92) & "n")
    s = Replace(s, vbCr, Chr(92) & "n")
    s = Replace(s, vbLf, Chr(92) & "n")
    s = Replace(s, vbTab, Chr(92) & "t")
    JsonEscape = s
End Function

Function JsonNumber(value)
    Dim n
    If IsNull(value) Then
        JsonNumber = "0"
    ElseIf Trim(CStr(value & "")) = "" Then
        JsonNumber = "0"
    ElseIf Not IsNumeric(value) Then
        JsonNumber = "0"
    Else
        n = CDbl(value)
        JsonNumber = Replace(CStr(n), ",", ".")
    End If
End Function

Function CountRecords(rs)
    Dim count
    On Error Resume Next
    count = rs.RecordCount
    If Err.Number <> 0 Or count < 0 Then
        Err.Clear
        count = 0
    End If
    On Error GoTo 0
    CountRecords = count
End Function

Sub SendError(message)
    Response.Status = "500 Internal Server Error"
    Response.Write "{""success"":false,""error"":""" & JsonEscape(message) & """}"
End Sub
%>
