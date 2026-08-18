import React from 'react';
import { useToast } from '../context/ToastContext';

// This is a convenience hook wrapper — the actual UI is rendered by ToastContext.
// Components can just import useToast directly.
export default function ToastContainer() {
  // Placeholder in case we want a separate container later.
  // All toast rendering lives inside ToastContext for global availability.
  return null;
}
