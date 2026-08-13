import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/chat_message.dart';
import '../models/chat_response.dart';
import 'auth_service.dart';

class ChatService {
  final String _backendUrl = 'https://fraldinha-livre-backend.romariobc.workers.dev';
  final AuthService _authService = AuthService();

  Future<ChatResponse> sendMessage(
    List<ChatMessage> history, {
    String? imageBase64,
    Map<String, dynamic>? userProfile,
    Map<String, dynamic>? lastPurchase,
  }) async {
    try {
      final token = await _authService.getIdToken();
      
      final headers = {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

      final body = jsonEncode({
        'messages': history.map((msg) => msg.toJson()).toList(),
        if (imageBase64 != null) 'image': imageBase64,
        if (userProfile != null) 'userProfile': userProfile,
        if (lastPurchase != null) 'lastPurchase': lastPurchase,
      });

      final response = await http.post(
        Uri.parse('$_backendUrl/chat/message'),
        headers: headers,
        body: body,
      );

      if (response.statusCode != 200) {
        throw Exception('Erro ao falar com o assistente (Status: ${response.statusCode})');
      }

      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      return ChatResponse.fromJson(decoded);
    } catch (e) {
      print('Erro no ChatService: $e');
      rethrow;
    }
  }
}
