import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { signInWithGoogle } from '../../services/auth';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Logo & Branding — matches home screen sizing */}
        <View style={styles.heroSection}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>
            <Text style={{ color: '#1A4A5A' }}>Find</Text>
            <Text style={{ color: '#178578' }}>It</Text>
          </Text>
          <Text style={styles.tagline}>Speak it. Store it. Find it.</Text>
        </View>

        {/* Hero Illustration */}
        <Image
          source={require('../../assets/images/onboarding.png')}
          style={styles.heroImage}
          resizeMode="contain"
        />

        {/* Value Prop */}
        <View style={styles.valueProps}>
          <Text style={styles.valueText}>
            Voice-log where you put things.{'\n'}Find them instantly with AI search.
          </Text>
        </View>

        {/* Sign In Button */}
        <View style={styles.authSection}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Image
                  source={{ uri: 'https://www.google.com/favicon.ico' }}
                  style={styles.googleIcon}
                />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.disclaimer}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E4EAEF',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 10,
    paddingBottom: 36,
  },
  // ─── HERO (matches home screen) ───
  heroSection: {
    alignItems: 'center',
    paddingTop: 110,
    paddingBottom: 24,
  },
  logo: {
    width: 140,
    height: 140,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 8,
  },
  tagline: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  // ─── ILLUSTRATION ───
  heroImage: {
    width: width - 56,
    height: 180,
    alignSelf: 'center',
    borderRadius: 16,
  },
  // ─── VALUE PROP ───
  valueProps: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  valueText: {
    fontSize: 15,
    color: '#1A1D2E',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  // ─── AUTH ───
  authSection: {
    alignItems: 'center',
    gap: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#178578',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    gap: 12,
    shadowColor: '#178578',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  googleIcon: {
    width: 20,
    height: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  disclaimer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
});
