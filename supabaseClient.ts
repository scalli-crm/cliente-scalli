
import { createClient } from '@supabase/supabase-js';

// Default Credentials (Fallback)
const defaultUrl = 'https://wucikfcqomfumakfqjxc.supabase.co';
const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1Y2lrZmNxb21mdW1ha2ZxanhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5Mjg3NDMsImV4cCI6MjA4MTUwNDc0M30.IHm1O1WM1tW-cqH5qzZpjYaWbOMUSoqp4ROuiXfdwU4';

// Check for custom configuration in LocalStorage
const storedUrl = localStorage.getItem('custom_supabase_url');
const storedKey = localStorage.getItem('custom_supabase_key');

// Determine which credentials to use
const supabaseUrl = storedUrl && storedUrl.trim() !== '' ? storedUrl : defaultUrl;
const supabaseKey = storedKey && storedKey.trim() !== '' ? storedKey : defaultKey;

export const supabase = createClient(supabaseUrl, supabaseKey);
