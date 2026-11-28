import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:material_ui/material_ui.dart';

import '../data/auth_models.dart';
import 'auth_cubit.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  late Future<List<UniversityOption>> _universitiesFuture;
  bool _isRegistering = false;
  bool _isSubmitting = false;
  String? _selectedUniversityId;

  @override
  void initState() {
    super.initState();
    _universitiesFuture = context.read<AuthCubit>().loadUniversities();
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'StudyBuddy',
                    style: Theme.of(context).textTheme.headlineMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: false, label: Text('Sign in')),
                      ButtonSegment(value: true, label: Text('Register')),
                    ],
                    selected: {_isRegistering},
                    onSelectionChanged: _isSubmitting
                        ? null
                        : (selection) =>
                              setState(() => _isRegistering = selection.first),
                  ),
                  const SizedBox(height: 20),
                  if (_isRegistering) ...[
                    TextFormField(
                      key: const Key('fullNameField'),
                      controller: _fullNameController,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(labelText: 'Full name'),
                      validator: (value) {
                        final name = value?.trim() ?? '';
                        if (name.isEmpty) {
                          return 'Enter your full name.';
                        }
                        if (name.length > 120) {
                          return 'Use 120 characters or fewer.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextFormField(
                    key: const Key('emailField'),
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    decoration: const InputDecoration(labelText: 'Email'),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Enter your email.'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    key: const Key('passwordField'),
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Password'),
                    validator: (value) => value == null || value.length < 8
                        ? 'Password must be at least 8 characters.'
                        : null,
                  ),
                  if (_isRegistering) ...[
                    const SizedBox(height: 12),
                    FutureBuilder<List<UniversityOption>>(
                      future: _universitiesFuture,
                      builder: (context, snapshot) {
                        if (snapshot.hasError) {
                          return Row(
                            children: [
                              const Expanded(
                                child: Text('Could not load universities.'),
                              ),
                              TextButton(
                                onPressed: () => setState(() {
                                  _universitiesFuture = context
                                      .read<AuthCubit>()
                                      .loadUniversities();
                                }),
                                child: const Text('Retry'),
                              ),
                            ],
                          );
                        }
                        if (!snapshot.hasData) {
                          return const LinearProgressIndicator(
                            key: Key('universitiesLoading'),
                          );
                        }
                        return DropdownButtonFormField<String>(
                          key: const Key('universityDropdown'),
                          initialValue: _selectedUniversityId ?? '',
                          decoration: const InputDecoration(
                            labelText: 'University (optional)',
                          ),
                          items: [
                            const DropdownMenuItem(
                              value: '',
                              child: Text('No university'),
                            ),
                            ...snapshot.data!.map(
                              (university) => DropdownMenuItem(
                                value: university.id,
                                child: Text(university.name),
                              ),
                            ),
                          ],
                          onChanged: (value) => setState(
                            () => _selectedUniversityId =
                                value == null || value.isEmpty ? null : value,
                          ),
                        );
                      },
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    key: const Key('authSubmitButton'),
                    onPressed: _isSubmitting ? null : _submit,
                    child: Text(_isRegistering ? 'Create account' : 'Sign in'),
                  ),
                  if (!_isRegistering)
                    const TextButton(
                      key: Key('forgotPasswordButton'),
                      onPressed: null,
                      child: Text('Forgot password? — Coming soon'),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);
    try {
      final cubit = context.read<AuthCubit>();
      if (_isRegistering) {
        await cubit.register(
          fullName: _fullNameController.text.trim(),
          email: _emailController.text.trim(),
          password: _passwordController.text,
          universityId: _selectedUniversityId,
        );
      } else {
        await cubit.login(
          _emailController.text.trim(),
          _passwordController.text,
        );
      }
    } on DioException catch (error) {
      if (mounted) _showError(_apiMessage(error));
    } on FormatException catch (error) {
      if (mounted) _showError(error.message);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String _apiMessage(DioException error) {
    final data = error.response?.data;
    if (data is Map<String, dynamic> &&
        data['error'] is Map<String, dynamic> &&
        (data['error'] as Map<String, dynamic>)['message'] is String) {
      return (data['error'] as Map<String, dynamic>)['message'] as String;
    }
    return 'Unable to complete the request. Check your connection and try again.';
  }
}
