import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/chat_message.dart';
import '../services/auth_service.dart';
import '../services/chat_service.dart';
import 'login_screen.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final AuthService _authService = AuthService();
  final ChatService _chatService = ChatService();
  final ImagePicker _picker = ImagePicker();
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  Map<String, dynamic>? _userProfile;

  final List<ChatMessage> _messages = [
    ChatMessage(
      role: 'assistant',
      content: 'Olá! Sou seu assistente de compras. Como posso ajudar você hoje?',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _loadUserProfile();
  }

  Future<void> _loadUserProfile() async {
    try {
      final profile = await _authService.getUserProfile();
      if (mounted) {
        setState(() {
          _userProfile = profile;
          
          if (profile != null && profile['lastPurchase'] != null) {
            final last = profile['lastPurchase'] as Map<String, dynamic>;
            final prodName = last['productName'] ?? 'Fralda';
            final qty = last['quantity'] ?? 1;
            
            _messages.clear();
            _messages.add(ChatMessage(
              role: 'assistant',
              content: 'Olá! Sou seu assistente de compras. Vi que seu último pedido foi $qty pacote(s) de $prodName. Gostaria de repetir esse pedido com apenas um clique?',
            ));
          }
        });
      }
    } catch (e) {
      print('Erro ao carregar perfil: $e');
    }
  }

  bool _sending = false;
  String? _pendingImageBase64;
  File? _pendingImageFile;
  String? _error;

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 80,
      );

      if (image == null) return;

      final bytes = await image.readAsBytes();
      final extension = image.path.split('.').last.toLowerCase();
      // Format supported types matching contracts (jpeg, png, webp, gif)
      final mimeType = extension == 'jpg' || extension == 'jpeg'
          ? 'image/jpeg'
          : 'image/$extension';
      
      final base64String = 'data:$mimeType;base64,${base64Encode(bytes)}';

      setState(() {
        _pendingImageBase64 = base64String;
        _pendingImageFile = File(image.path);
      });
      _scrollToBottom();
    } catch (e) {
      setState(() {
        _error = 'Erro ao selecionar imagem.';
      });
    }
  }

  Future<void> _handleSend() async {
    final text = _inputController.text.trim();
    if (text.isEmpty && _pendingImageBase64 == null) return;
    if (_sending) return;

    final userMessage = ChatMessage(
      role: 'user',
      content: text.isNotEmpty ? text : '(foto anexada)',
      imageUrl: _pendingImageBase64,
    );

    setState(() {
      _messages.add(userMessage);
      _inputController.clear();
      _pendingImageBase64 = null;
      _pendingImageFile = null;
      _sending = true;
      _error = null;
    });
    _scrollToBottom();

    try {
      final Map<String, dynamic>? cleanedProfile = _userProfile != null ? {
        'name': _userProfile!['name'],
        if (_userProfile!['address'] != null) 'address': Map<String, dynamic>.from(_userProfile!['address'] as Map),
      } : null;

      final Map<String, dynamic>? cleanedLastPurchase = _userProfile != null && _userProfile!['lastPurchase'] != null
          ? Map<String, dynamic>.from(_userProfile!['lastPurchase'] as Map)
          : null;

      final response = await _chatService.sendMessage(
        _messages,
        userProfile: cleanedProfile,
        lastPurchase: cleanedLastPurchase,
      );
      
      if (response.type == 'text') {
        setState(() {
          _messages.add(ChatMessage(
            role: 'assistant',
            content: response.content ?? 'Não entendi. Pode reformular?',
          ));
        });
      } else if (response.type == 'action') {
        final productId = response.productId;
        final quantity = response.quantity ?? 1;

        if (productId != null) {
          setState(() {
            _messages.add(ChatMessage(
              role: 'assistant',
              content: 'Redirecionando você para o checkout de pagamento...',
            ));
          });

          final Map<String, String> queryParameters = {
            'productId': productId,
            'quantity': quantity.toString(),
          };

          if (response.paymentMethod != null) {
            queryParameters['paymentMethod'] = response.paymentMethod!;
          }

          if (response.address != null) {
            final addr = response.address!;
            if (addr['cep'] != null) queryParameters['cep'] = addr['cep'].toString();
            if (addr['logradouro'] != null) queryParameters['logradouro'] = addr['logradouro'].toString();
            if (addr['numero'] != null) queryParameters['numero'] = addr['numero'].toString();
            if (addr['complemento'] != null) queryParameters['complemento'] = addr['complemento'].toString();
            if (addr['bairro'] != null) queryParameters['bairro'] = addr['bairro'].toString();
            if (addr['cidade'] != null) queryParameters['cidade'] = addr['cidade'].toString();
            if (addr['estado'] != null) queryParameters['estado'] = addr['estado'].toString();
          }

          final checkoutUrl = Uri.https(
            'fraldinha-livre-frontend.romariobc.workers.dev',
            '/checkout',
            queryParameters,
          );
          
          if (await launchUrl(checkoutUrl, mode: LaunchMode.externalApplication)) {
            // Success
          } else {
            setState(() {
              _error = 'Não foi possível abrir a página de checkout.';
            });
          }
        }
      }
    } catch (e) {
      setState(() {
        _error = 'Não foi possível falar com o assistente. Tente de novo.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
        _scrollToBottom();
      }
    }
  }

  Future<void> _handleLogout() async {
    await _authService.signOut();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F7FA),
      appBar: AppBar(
        title: const Text(
          'Assistente de Compra',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 20,
            color: Color(0xFF1E293B),
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 1,
        shadowColor: const Color(0x10000000),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Color(0xFF64748B)),
            onPressed: _handleLogout,
            tooltip: 'Sair da conta',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.all(16.0),
                itemCount: _messages.length + (_sending ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index == _messages.length && _sending) {
                    return _buildTypingIndicator();
                  }
                  
                  final message = _messages[index];
                  final isUser = message.role == 'user';
                  
                  return _buildMessageBubble(message, isUser);
                },
              ),
            ),
            if (_error != null) _buildErrorBanner(),
            _buildInputBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage message, bool isUser) {
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12.0),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.8,
        ),
        decoration: BoxDecoration(
          color: isUser ? const Color(0xFF38BDF8) : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isUser ? 16 : 4),
            bottomRight: Radius.circular(isUser ? 4 : 16),
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x05000000),
              blurRadius: 4,
              offset: Offset(0, 2),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (message.imageUrl != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.memory(
                  base64Decode(message.imageUrl!.split(',').last),
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      const Icon(Icons.broken_image, size: 100),
                ),
              ),
              const SizedBox(height: 8),
            ],
            if (message.content != null && message.content!.isNotEmpty)
              Text(
                message.content!,
                style: TextStyle(
                  color: isUser ? Colors.white : const Color(0xFF1E293B),
                  fontSize: 15,
                  height: 1.4,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTypingIndicator() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12.0),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(16),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x05000000),
              blurRadius: 4,
              offset: Offset(0, 2),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 14.0),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildDot(0),
            const SizedBox(width: 4),
            _buildDot(1),
            const SizedBox(width: 4),
            _buildDot(2),
          ],
        ),
      ),
    );
  }

  Widget _buildDot(int index) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 300 + index * 100),
      builder: (context, value, child) {
        return Transform.scale(
          scale: 0.6 + 0.4 * (1.0 - (value - 0.5).abs() * 2),
          child: Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: Color(0xFF94A3B8),
              shape: BoxShape.circle,
            ),
          ),
        );
      },
      onEnd: () {
        if (mounted) setState(() {});
      },
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      color: Colors.red[50],
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      width: double.infinity,
      child: Text(
        _error!,
        style: const TextStyle(
          color: Colors.red,
          fontSize: 13,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildInputBar() {
    return Container(
      padding: const EdgeInsets.all(12.0),
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Color(0x05000000),
            blurRadius: 10,
            offset: Offset(0, -5),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_pendingImageFile != null) _buildPendingImagePreview(),
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.camera_alt, color: Color(0xFF64748B)),
                onPressed: () => _pickImage(ImageSource.camera),
              ),
              IconButton(
                icon: const Icon(Icons.photo, color: Color(0xFF64748B)),
                onPressed: () => _pickImage(ImageSource.gallery),
              ),
              Expanded(
                child: TextField(
                  controller: _inputController,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _handleSend(),
                  decoration: const InputDecoration(
                    hintText: 'Preciso de fralda tamanho M...',
                    hintStyle: TextStyle(color: Color(0xFF94A3B8)),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(horizontal: 12.0),
                  ),
                  style: const TextStyle(color: Color(0xFF1E293B)),
                ),
              ),
              FloatingActionButton(
                onPressed: _handleSend,
                mini: true,
                backgroundColor: const Color(0xFF38BDF8),
                elevation: 0,
                child: const Icon(Icons.send, color: Colors.white, size: 18),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPendingImagePreview() {
    return Container(
      margin: const EdgeInsets.only(bottom: 8.0),
      height: 80,
      child: Row(
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.file(
                  _pendingImageFile!,
                  height: 80,
                  width: 80,
                  fit: BoxFit.cover,
                ),
              ),
              Positioned(
                right: 4,
                top: 4,
                child: GestureDetector(
                  onTap: () {
                    setState(() {
                      _pendingImageBase64 = null;
                      _pendingImageFile = null;
                    });
                  },
                  child: Container(
                    decoration: const BoxDecoration(
                      color: Colors.black54,
                      shape: BoxShape.circle,
                    ),
                    padding: const EdgeInsets.all(4),
                    child: const Icon(
                      Icons.close,
                      color: Colors.white,
                      size: 14,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
