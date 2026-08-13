import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'views/login_screen.dart';
import 'views/chat_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Inicialização portátil do Firebase para todas as plataformas (Android, iOS, Web, Windows).
  // Os valores batem com as chaves de produção configuradas no frontend.
  await Firebase.initializeApp(
    options: const FirebaseOptions(
      apiKey: 'AIzaSyBPsjYjlaTKJ7KuP-SMd2O6M878hKNG2Vw',
      authDomain: 'fraldinha-livre.firebaseapp.com',
      projectId: 'fraldinha-livre',
      storageBucket: 'fraldinha-livre.firebasestorage.app',
      messagingSenderId: '870655271908',
      appId: '1:870655271908:web:1c9205f6f593ec1ea3ddf1',
    ),
  );

  // Inicialização do GoogleSignIn para o fluxo de autenticação por OAuth.
  await GoogleSignIn.instance.initialize(
    serverClientId: '870655271908-if18qhs493v7kr3b0l7rakqlfaimehpf.apps.googleusercontent.com',
  );

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fraldinha Livre',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF38BDF8),
          primary: const Color(0xFF38BDF8),
        ),
        scaffoldBackgroundColor: const Color(0xFFF3F7FA),
        useMaterial3: true,
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }
        
        if (snapshot.hasData) {
          return const ChatScreen();
        }
        
        return const LoginScreen();
      },
    );
  }
}
