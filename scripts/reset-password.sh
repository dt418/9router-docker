#!/bin/bash
# Reset 9Router password (INITIAL_PASSWORD) to default value
# This script resets the login password in .env and optionally clears stored password hashes.

set -euo pipefail

ENV_FILE="${1:-.env}"
BACKUP_DIR="data/backups"
DEFAULT_INITIAL_PASSWORD="ChangeMe123!"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() {
	echo -e "${RED}[ERROR]${NC} $1"
	exit 1
}

# Check if .env exists
if [[ ! -f "$ENV_FILE" ]]; then
	error "File $ENV_FILE not found."
fi

# Backup current .env
backup_env() {
	mkdir -p "$BACKUP_DIR"
	local timestamp=$(date +%Y%m%d_%H%M%S)
	local backup_file="$BACKUP_DIR/.env.backup.$timestamp"
	cp "$ENV_FILE" "$backup_file"
	success "Backup created: $backup_file"
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

# Clear password hash from db.json if it exists
clear_password_hash() {
	local db_file="data/db.json"
	if [[ -f "$db_file" ]]; then
		info "Clearing password hash from database..."
		# Create backup of db.json
		local timestamp=$(date +%Y%m%d_%H%M%S)
		cp "$db_file" "$BACKUP_DIR/db.json.backup.$timestamp"

		# Use node to clear password field
		node -e "
const fs = require('fs');
const db = JSON.parse(fs.readFileSync('$db_file', 'utf8'));
if (db.settings) {
    delete db.settings.password;
    fs.writeFileSync('$db_file', JSON.stringify(db, null, 2));
    console.log('Password hash cleared from db.json');
} else {
    console.log('No settings found in db.json');
}
" 2>/dev/null && success "Password hash cleared from database" || warn "Could not clear password from database"
	fi
}

# Show current password (masked)
show_current_password() {
	echo ""
	info "Current INITIAL_PASSWORD in $ENV_FILE:"
	echo "----------------------------------------"

	local value=$(grep "^INITIAL_PASSWORD=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "NOT SET")
	if [[ "$value" != "NOT SET" && ${#value} -gt 4 ]]; then
		local masked="${value:0:2}****${value: -2}"
		printf "  %-20s = %s\n" "INITIAL_PASSWORD" "$masked"
	else
		printf "  %-20s = %s\n" "INITIAL_PASSWORD" "$value"
	fi
	echo "----------------------------------------"
}

# Generate a random password using openssl
generate_password() {
	local length=${1:-16}
	if command -v openssl &>/dev/null; then
		openssl rand -base64 "$length" | tr -d '/+=' | head -c "$length"
	else
		echo "ERROR: openssl not found. Install openssl to generate secure passwords." >&2
		exit 1
	fi
}

# Main logic
main() {
	echo ""
	echo "=========================================="
	echo "   9Router Password Reset Tool"
	echo "=========================================="
	echo ""

	# Show current state
	show_current_password

	# Choose reset mode
	echo ""
	info "Reset options:"
	echo "  1) Reset to default password (insecure, for testing only)"
	echo "  2) Generate new random password (recommended)"
	echo "  3) Set custom password"
	echo "  4) Cancel"
	echo ""
	read -p "Select option (1-4): " option

	case $option in
	1)
		# Reset to default
		read -p "Reset to default password? This is INSECURE. (y/N): " -n 1 -r
		echo ""
		if [[ ! $REPLY =~ ^[Yy]$ ]]; then
			info "Cancelled."
			exit 0
		fi

		info "Creating backup..."
		backup_env

		info "Resetting to default password..."
		update_key "INITIAL_PASSWORD" "$DEFAULT_INITIAL_PASSWORD" "$ENV_FILE"

		clear_password_hash

		success "Password reset to default!"
		warn "WARNING: Default password is insecure. Change it immediately in production."
		;;

	2)
		# Generate random password
		info "Creating backup..."
		backup_env

		local new_password=$(generate_password 12)

		info "Generated new random password:"
		echo ""
		warn "Save this password securely:"
		echo "----------------------------------------"
		echo "INITIAL_PASSWORD=$new_password"
		echo "----------------------------------------"
		echo ""

		read -p "Apply this new password? (y/N): " -n 1 -r
		echo ""
		if [[ ! $REPLY =~ ^[Yy]$ ]]; then
			info "Cancelled. Password not applied."
			exit 0
		fi

		update_key "INITIAL_PASSWORD" "$new_password" "$ENV_FILE"

		clear_password_hash

		success "Random password generated and applied!"
		;;

	3)
		# Custom password
		read -sp "Enter new INITIAL_PASSWORD: " new_password
		echo ""
		read -sp "Confirm new INITIAL_PASSWORD: " confirm_password
		echo ""

		if [[ "$new_password" != "$confirm_password" ]]; then
			error "Passwords do not match!"
		fi

		if [[ ${#new_password} -lt 6 ]]; then
			error "Password must be at least 6 characters!"
		fi

		info "Creating backup..."
		backup_env

		update_key "INITIAL_PASSWORD" "$new_password" "$ENV_FILE"

		clear_password_hash

		success "Custom password applied!"
		;;

	4 | *)
		info "Cancelled."
		exit 0
		;;

	esac

	echo ""
	warn "IMPORTANT: After password reset, you may need to:"
	echo "  1. Restart the application"
	echo "  2. Re-authenticate with new credentials"
	echo "  3. Login with the new password on dashboard"
	echo ""

	# Show final state
	show_current_password
}

main "$@"
