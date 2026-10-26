ALTER TABLE catalog_families ADD COLUMN exercise_type TEXT CHECK (exercise_type IN ('compound','isolation'));
