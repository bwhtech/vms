<template>
	<div class="space-y-4">
		<FormControl id="r2_account_id" v-model="form.r2_account_id" label="Account ID" required />
		<div class="grid gap-4 sm:grid-cols-2">
			<FormControl
				id="r2_access_key_id"
				v-model="form.r2_access_key_id"
				label="Access Key ID"
				required
			/>
			<FormControl
				id="r2_secret_access_key"
				v-model="form.r2_secret_access_key"
				type="password"
				label="Secret Access Key"
				required
			/>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<FormControl
				id="r2_bucket_name"
				v-model="form.r2_bucket_name"
				label="Bucket Name"
				required
			/>
			<FormControl
				id="r2_public_url"
				v-model="form.r2_public_url"
				label="Public URL"
				placeholder="https://cdn.example.com"
				description="Optional. A custom domain in front of the bucket."
			/>
		</div>
		<FormControl
			id="cloudflare_api_token"
			v-model="form.cloudflare_api_token"
			type="password"
			label="Cloudflare API Token"
			description="For bucket usage stats. Create it under Cloudflare Dashboard › My Profile › API Tokens."
		/>
		<div class="flex items-center gap-2">
			<Button
				label="Test Connection"
				icon-left="lucide-plug-zap"
				:loading="testing"
				:disabled="!form.r2_account_id || !form.r2_bucket_name"
				@click="testConnection(form)"
			/>
			<slot name="actions" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button, FormControl } from 'frappe-ui'
import { useR2Test, type R2Form } from './useVmsSettings'

/** R2 credential fields plus "Test Connection". Shared by General and the wizard. */
const form = defineModel<R2Form>({ required: true })

const { testConnection, testing } = useR2Test()
</script>
