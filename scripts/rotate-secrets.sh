#!/bin/bash
# Rotate secrets in .env file
# This script generates new random values for security-sensitive keys
# and updates the .env file while preserving other settings.

set -euo pipefail

ENV_FILE="${1:-.env}"
BACKUP_DIR="data/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper: print colored message
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() {
	echo -e "${RED}[ERROR]${NC} $1"
	exit 1
}

# Check if .env exists
if [[ ! -f "$ENV_FILE" ]]; then
	error "File $ENV_FILE not found. Run from project root or pass path as argument."
fi

# Generate random hex string (length bytes -> 2*length hex chars)
generate_hex() {
	local length=$1
	if command -v openssl &>/dev/null; then
		openssl rand -hex "$length"
	else
		echo "ERROR: openssl not found. Install openssl to generate secure keys." >&2
		exit 1
	fi
}

# Backup current .env
backup_env() {
	mkdir -p "$BACKUP_DIR"
	local timestamp=$(date +%Y%m%d_%H%M%S)
	local backup_file="$BACKUP_DIR/.env.backup.$timestamp"
	cp "$ENV_FILE" "$backup_file"
	success "Backup created: $backup_file"
	echo "$backup_file"
}

# Update a key in .env file (safe for special characters in value)
update_key() {
	local key=$1
	local value=$2
	local file=$3

	if grep -q "^${key}=" "$file"; then
		awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {$2=v} 1' "$file" >"$file.tmp" && mv "$file.tmp" "$file"
	else
		echo "${key}=${value}" >>"$file"
	fi
}

# Show current secrets (masked)
show_current_secrets() {
	echo ""
	info "Current secrets in $ENV_FILE:"
	echo "----------------------------------------"

	for key in JWT_SECRET API_KEY_SECRET MACHINE_ID_SALT; do
		local value=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "NOT SET")
		if [[ "$value" != "NOT SET" && ${#value} -gt 8 ]]; then
			local masked="${value:0:4}****${value: -4}"
			printf "  %-20s = %s\n" "$key" "$masked"
		else
			printf "  %-20s = %s\n" "$key" "$value"
		fi
	done
	echo "----------------------------------------"
}

# Main rotation logic
main() {
	echo ""
	echo "=========================================="
	echo "   9Router Secret Rotation Tool"
	echo "=========================================="
	echo ""

	# Show current state
	show_current_secrets

	# Confirmation
	read -p "Do you want to rotate these secrets? (y/N): " -n 1 -r
	echo ""
	if [[ ! $REPLY =~ ^[Yy]$ ]]; then
		info "Rotation cancelled."
		exit 0
	fi

	# Backup first
	info "Creating backup..."
	local backup_file=$(backup_env)

	# Generate new values
	info "Generating new secrets..."
	local new_jwt=$(generate_hex 32)     # 64 hex chars
	local new_api_key=$(generate_hex 16) # 32 hex chars
	local new_salt=$(generate_hex 16)    # 32 hex chars

	# Show new values
	echo ""
	info "New secrets generated:"
	echo "----------------------------------------"
	printf "  %-20s = %s\n" "JWT_SECRET" "$new_jwt"
	printf "  %-20s = %s\n" "API_KEY_SECRET" "$new_api_key"
	printf "  %-20s = %s\n" "MACHINE_ID_SALT" "$new_salt"
	echo "----------------------------------------"

	# Update .env file
	info "Updating $ENV_FILE..."
	update_key "JWT_SECRET" "$new_jwt" "$ENV_FILE"
	update_key "API_KEY_SECRET" "$new_api_key" "$ENV_FILE"
	update_key "MACHINE_ID_SALT" "$new_salt" "$ENV_FILE"

	success "Secrets rotated successfully!"
	echo ""
	warn "IMPORTANT: Save these new secrets in a secure location:"
	echo "----------------------------------------"
	echo "JWT_SECRET=$new_jwt"
	echo "API_KEY_SECRET=$new_api_key"
	echo "MACHINE_ID_SALT=$new_salt"
	echo "----------------------------------------"
	echo ""
	warn "Note: After rotation, you may need to:"
	echo "  1. Restart the application"
	echo "  2. Re-authenticate (JWT tokens will be invalid)"
	echo "  3. Update any external integrations using API keys"
	echo ""
	info "Backup location: $backup_file"
	echo ""
}

main "$@"
