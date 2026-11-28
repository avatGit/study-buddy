import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

typedef RequestHandler = Future<ResponseBody> Function(RequestOptions options);

class TestHttpAdapter implements HttpClientAdapter {
  TestHttpAdapter(this.handle);

  final RequestHandler handle;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) => handle(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody jsonResponse(int statusCode, Object? body) =>
    ResponseBody.fromString(
      jsonEncode(body),
      statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
